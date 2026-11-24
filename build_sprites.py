import os
import glob
import re
import io
import json
from PIL import Image
import numpy as np
from rembg import remove
from scipy import ndimage

def process_pokemon(img_path, output_dir, pokemon_id, name, is_front):
    print(f"Processing: {img_path} (ID: {pokemon_id}, Name: {name})")
    try:
        with open(img_path, 'rb') as f:
            input_bytes = f.read()

        # 1. Load and Crop
        img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
        w, h = img.size
        left = int(w * 0.05)
        top = int(h * 0.06)
        right = int(w * 0.95)
        bottom = int(h * 0.38)
        img_cropped = img.crop((left, top, right, bottom))

        # 2. Background Removal
        img_transparent = remove(img_cropped)

        # 3. Trim and Squareify (content extraction)
        alpha = img_transparent.getchannel('A')
        bbox = alpha.getbbox()
        if not bbox: return None
        img_content = img_transparent.crop(bbox)
        c_w, c_h = img_content.size

        # 4. Prepare Canvas (72x72) and Placement
        canvas_size = 72
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        scale_factor = 68.0 / max(c_w, c_h)
        new_w, new_h = int(c_w * scale_factor), int(c_h * scale_factor)
        img_resized = img_content.resize((new_w, new_h), Image.Resampling.LANCZOS)

        if is_front: # Centered
            y_offset = (canvas_size - new_h) // 2
        else: # Grounded to bottom
            y_offset = canvas_size - new_h
        x_offset = (canvas_size - new_w) // 2
        canvas.paste(img_resized, (x_offset, y_offset), img_resized)

        # Step 4: Pixelize & Colorization
        alpha = canvas.getchannel('A')
        binarized_alpha = alpha.point(lambda p: 255 if p >= 128 else 0)
        canvas.putalpha(binarized_alpha)

        rgb_img = canvas.convert("RGB")
        palette_img = rgb_img.quantize(colors=8, dither=Image.Dither.NONE).convert("RGBA")
        rgba_quantized = palette_img.copy()
        rgba_quantized.putalpha(binarized_alpha)
        canvas = rgba_quantized

        # C. Outline enhancement: #14141E (RGB 20, 20, 30)
        data = np.array(canvas).astype(np.uint8)
        is_opaque = data[:, :, 3] > 0
        struct = np.ones((3, 3), dtype=bool)
        dilated_mask = ndimage.binary_dilation(is_opaque, structure=struct)
        inside_core = ndimage.binary_erosion(is_opaque, structure=struct)
        border_mask = dilated_mask & ~inside_core

        data[border_mask] = [20, 20, 30, 255]
        canvas = Image.fromarray(data, "RGBA")

        # Final save: Save as PNG in the assets directory
        os.makedirs(output_dir, exist_ok=True)
        file_name = f"{pokemon_id}_{name}_{'front' if is_front else 'back'}.png"
        save_path = os.path.join(output_dir, file_name)
        canvas.convert("RGBA").save(save_path, "PNG")
        print(f"Successfully saved: {save_path}")
        return save_path

    except Exception as e:
        import traceback; traceback.print_exc()
        return None

def main():
    raw_dir = "./raw_screenshots/"
    output_assets_dir = "./output/assets"
    os.makedirs("./output", exist_ok=True)
    os.makedirs(output_assets_dir, exist_ok=True)
    manifest = {"sprite_size": 72, "pokemons": []}

    files = glob.glob(os.path.join(raw_dir, "*"))
    processed_ids = {}

    for f in files:
        filename = os.path.basename(f)
        match = re.search(r"(\d+)_([^_]+)_(front|back)\.(png|PNG|jpg|JPG|jpeg|JPEG)$", filename, re.IGNORECASE)
        if not match: continue
        p_id, name, type_str_raw, _ = match.groups()
        type_str = type_str_raw.lower()
        is_front = (type_str == 'front')

        saved_path = process_pokemon(f, output_assets_dir, p_id, name, is_front)
        if saved_path:
            # Manifest path should be relative to ./output/manifest.json -> ./assets/...
            rel_path = f"./assets/{p_id}_{name}_{type_str}.png"
            if p_id not in processed_ids:
                processed_ids[p_id] = {"id": p_id, "name": name, "sprites": {}}
            processed_ids[p_id]["sprites"][type_str] = rel_path

    for pid in sorted(processed_ids.keys()):
        manifest["pokemons"].append(processed_ids[pid])

    with open("./output/manifest.json", "w", encoding="utf-8") as f:
        import json
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print("Manifest generated successfully.")

if __name__ == "__main__":
    main()
