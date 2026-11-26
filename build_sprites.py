#!/usr/bin/env python3
"""
build_sprites.py

ポケモンGO図鑑スクショから、スマホ向けWeb PvPバトルゲーム用の
**72x72px 高精細ドット絵スプライト（front / back）** をPNGで生成するパイプライン。

パイプライン:
  1. UI除去  : 図鑑画面専用の厳密クロップ (left/top/right/bottom 比率)
  2. 背景除去: rembg でポケモン本体のみを抽出 (RGBA)
  3. トリミング&正方形化: 不透明ピクセルのバウンドボックスをトリムし正方形キャンバスに配置
       - front: 中央に配置 (下端に2pxの余白)
       - back : 下辺に接地して配置 (バストアップ構図)
  4. ドット絵化 (72x72):
       - Image.Resampling.LANCZOS で 72x72 にリサイズ
       - アルファ二値化 (>=128 -> 255, <128 -> 0)
       - RGBを最大8色に減色 (Dither.NONE, 輪郭色 #14141E をパレットに含む)
       - 輪郭線の強調 (透明ピクセルに隣接する不透明ピクセルを #14141E に置換)
  5. 保存 : ./output/assets/{ID}_{front|back}.png

使い方:
  python3 build_sprites.py --test   # 最初の1体(front/back)のみ変換し検証をログ出力
  python3 build_sprites.py          # 全画像をバッチ処理し manifest.json を生成
"""

import os
import re
import sys
import json
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage
import rembg

# ----------------------------- 定数 -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "raw_screenshots")
OUT_DIR = os.path.join(BASE_DIR, "output")
ASSETS_DIR = os.path.join(OUT_DIR, "assets")
MANIFEST_PATH = os.path.join(OUT_DIR, "manifest.json")

SPRITE_SIZE = 72
MAX_COLORS = 8
ALPHA_THRESHOLD = 128
OUTLINE_COLOR = (0x14, 0x14, 0x1E)  # 濃紺〜黒

# {ID}_{ポケモン名}_{front|back}.png   (拡張子の大文字小文字を許容)
FILE_RE = re.compile(r"^(\d+)_(.+?)_(front|back)\.(png|jpg|jpeg)$", re.IGNORECASE)


# ----------------------------- 解析 -----------------------------
def parse_filename(filename):
    """ファイル名から (id, name, view) を返す。解析不能なら None."""
    m = FILE_RE.match(os.path.basename(filename))
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


# ----------------------------- 処理ステップ -----------------------------
def crop_ui(img):
    """図鑑画面のUI（上部ステータスバー / 下部 名・フォルム・タイプアイコン行）を除去する厳密クロップ."""
    w, h = img.size
    left = int(w * 0.05)
    top = int(h * 0.06)
    right = int(w * 0.95)
    bottom = int(h * 0.38)
    return img.crop((left, top, right, bottom))


def remove_background(img):
    """rembg で背景を除去し、ポケモン本体のみ (RGBA) を返す."""
    return rembg.remove(img)


def trim_and_square(rgba, view):
    """不透明ピクセル (Alpha > 128) のバウンディングボックスをトリムし正方形キャンバスに配置する.

    front: 正方形キャンサスの中央に配置（下端に2pxの余白）
    back : 正方形キャンサスの下辺に接地させて配置（バストアップ構図）
    """
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    mask = alpha > ALPHA_THRESHOLD
    ys, xs = np.where(mask)
    if ys.size == 0:
        print("    [trim] WARNING: no opaque pixels found")
        return Image.new("RGBA", (SPRITE_SIZE, SPRITE_SIZE), (0, 0, 0, 0))

    x0, y0 = int(xs.min()), int(ys.min())
    x1, y1 = int(xs.max()), int(ys.max())
    bw = x1 - x0 + 1
    bh = y1 - y0 + 1
    subject = rgba.crop((x0, y0, x1, y1))  # bw x bh

    s = max(bw, bh)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    x = (s - bw) // 2
    if view == "front":
        y = max(0, (s - bh - 2) // 2)  # 中央配置 + 下端2px余白
    else:
        y = s - bh                     # 下辺に接地
    canvas.paste(subject, (x, y), subject)
    print(f"    [trim] bbox={bw}x{bh}  square={s}x{s}  view={view}  pos=({x},{y})")
    return canvas


def quantize_to_palette(rgba):
    """RGB部分を最大8色に減色し、輪郭色 #14141E をパレットに含める.

    ディザリングなし。最も暗い色を輪郭色 #14141E に置換することで、
    陰影と輪郭を共用し、総色数を8色以内に保つつくっきりした輪郭を得る。
    """
    rgb = rgba.convert("RGB")
    q = rgb.quantize(
        colors=MAX_COLORS,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    pal = q.getpalette()
    colors = [tuple(pal[i:i + 3]) for i in range(0, 3 * MAX_COLORS, 3)]

    def lum(c):
        return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

    darkest = min(range(MAX_COLORS), key=lambda i: lum(colors[i]))
    colors[darkest] = OUTLINE_COLOR

    newpal = list(pal)
    for i in range(MAX_COLORS):
        newpal[i * 3:i * 3 + 3] = colors[i]
    q.putpalette(newpal)

    out = q.convert("RGB").convert("RGBA")
    out.putalpha(rgba.split()[-1])  # 二値化したアルファを保持
    return out


def apply_outline(rgba):
    """透明ピクセルに隣接する不透明ピクセル（外周1px、8近傍）を輪郭色に置き換え."""
    arr = np.array(rgba, dtype=np.uint8)
    alpha = arr[:, :, 3]
    transparent = (alpha == 0)
    opaque = (alpha == 255)
    # 8近傍で不透明ピクセルが透明ピクセルに隣接するかを判定（外周1pxの輪郭）
    dil = ndimage.binary_dilation(transparent, structure=np.ones((3, 3)))
    outline = opaque & dil
    arr[outline, 0] = OUTLINE_COLOR[0]
    arr[outline, 1] = OUTLINE_COLOR[1]
    arr[outline, 2] = OUTLINE_COLOR[2]
    return Image.fromarray(arr, "RGBA")


def dotify(rgba):
    """72x72px 高精細レトロドット絵に変換."""
    # 1. LANCZOS で 72x72 にリサイズ（角・トゲ・模様のラインを維持）
    img = rgba.resize((SPRITE_SIZE, SPRITE_SIZE), Image.Resampling.LANCZOS)
    # 2. アルファチャンネルの二値化
    arr = np.array(img, dtype=np.uint8)
    arr[:, :, 3] = np.where(arr[:, :, 3] >= ALPHA_THRESHOLD, 255, 0)
    img = Image.fromarray(arr, "RGBA")
    # 3. 減色（最大8色、ディザリングなし、輪郭色を含む）
    img = quantize_to_palette(img)
    # 4. 輪郭線の強調
    img = apply_outline(img)
    return img


# ----------------------------- 検証 -----------------------------
def count_colors(img):
    """不透明ピクセルの異なるRGBカラー数（色数）を返す."""
    arr = np.array(img)
    alpha = arr[:, :, 3]
    opaque = arr[alpha == 255]
    if opaque.size == 0:
        return 0
    return len(np.unique(opaque[:, :3].reshape(-1, 3), axis=0))


def verify(img, path, detailed=True):
    w, h = img.size
    ncolors = count_colors(img)
    alpha_vals = set(int(v) for v in np.unique(np.array(img)[:, :, 3]))
    ok_size = (w, h) == (SPRITE_SIZE, SPRITE_SIZE)
    ok_colors = ncolors <= MAX_COLORS
    ok_alpha = alpha_vals <= {0, 255}
    if detailed:
        print(f"    [verify] path={os.path.basename(path)}")
        print(f"    [verify] size={w}x{h} (expected {SPRITE_SIZE}x{SPRITE_SIZE}) {'OK' if ok_size else 'FAIL'}")
        print(f"    [verify] distinct colors (opaque)={ncolors} (expected <= {MAX_COLORS}) {'OK' if ok_colors else 'FAIL'}")
        print(f"    [verify] alpha values={sorted(alpha_vals)} (expected [0, 255]) {'OK' if ok_alpha else 'FAIL'}")
    else:
        status = "OK" if (ok_size and ok_colors and ok_alpha) else "FAIL"
        print(f"    [verify] {os.path.basename(path)}: {w}x{h}, {ncolors} colors, alpha={sorted(alpha_vals)} -> {status}")
    return ok_size and ok_colors and ok_alpha


# ----------------------------- メイン -----------------------------
def process_file(path, out_dir):
    """1つのスクショファイルからスプライトを生成し、保存先を返す（失敗なら None）."""
    _id, name, view = parse_filename(os.path.basename(path))
    if _id is None:
        print(f"  [skip] cannot parse filename: {os.path.basename(path)}")
        return None, None

    print(f"  [process] {os.path.basename(path)}  ({_id} {name} / {view})")
    img = Image.open(path).convert("RGBA")
    crop = crop_ui(img)
    bg = remove_background(crop)
    square = trim_and_square(bg, view)
    sprite = dotify(square)

    out_path = os.path.join(out_dir, f"{_id}_{view}.png")
    sprite.save(out_path)
    print(f"  [saved]   {out_path}")
    return out_path, sprite


def main():
    parser = argparse.ArgumentParser(description="Poke GO screenshot -> 72x72 dot-art sprite pipeline")
    parser.add_argument("--test", action="store_true",
                        help="最初の1体(front/back)のみ変換し、検証をログ出力（manifest生成しない）")
    parser.add_argument("--all", action="store_true",
                        help="全画像をバッチ処理し manifest.json を生成（デフォルト）")
    args = parser.parse_args()

    if not os.path.isdir(RAW_DIR):
        print(f"ERROR: raw_screenshots dir not found: {RAW_DIR}")
        sys.exit(1)

    files = sorted(f for f in os.listdir(RAW_DIR) if parse_filename(f) is not None)
    if not files:
        print("ERROR: no valid screenshot files found in raw_screenshots/")
        sys.exit(1)

    os.makedirs(ASSETS_DIR, exist_ok=True)

    # ID でグループ化し、ID 昇順で並び付け
    by_id = {}
    for f in files:
        _id, name, view = parse_filename(f)
        by_id.setdefault(_id, {"name": name, "files": []})
        by_id[_id]["files"].append(f)
    sorted_ids = sorted(by_id.keys())

    if args.test:
        first_id = sorted_ids[0]
        print(f"== TEST MODE: processing first pokemon ({first_id}, {by_id[first_id]['name']}) ==")
        all_ok = True
        for f in by_id[first_id]["files"]:
            out, sprite = process_file(os.path.join(RAW_DIR, f), ASSETS_DIR)
            if sprite is not None:
                all_ok = all_ok and verify(sprite, out, detailed=True)
        print(f"\n== TEST RESULT: {'PASS' if all_ok else 'FAIL'} ==")
        sys.exit(0 if all_ok else 2)
        return

    # ---- バッチ処理（全画像）+ manifest 生成 ----
    print(f"== BATCH MODE: processing {len(files)} files ==")
    pokemons = []
    for _id in sorted_ids:
        info = by_id[_id]
        sprites = {}
        for f in info["files"]:
            out, sprite = process_file(os.path.join(RAW_DIR, f), ASSETS_DIR)
            if sprite is not None:
                view = parse_filename(f)[2]
                sprites[view] = f"./assets/{_id}_{view}.png"
        # 仕様例に合わせて front を back の前に並べる
        sprites = {v: sprites[v] for v in ("front", "back") if v in sprites}
        pokemons.append({"id": _id, "name": info["name"], "sprites": sprites})

    manifest = {"sprite_size": SPRITE_SIZE, "pokemons": pokemons}
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"\n== DONE: wrote {MANIFEST_PATH} ({len(pokemons)} pokemons) ==")
    for p in pokemons:
        print(f"   - {p['id']} {p['name']}: {list(p['sprites'].keys())}")


if __name__ == "__main__":
    main()
