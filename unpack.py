
import argparse
import fnmatch
import os
import re

# 【globパターンで指定】上書きを完全に禁止するファイル・ディレクトリのパターン
PROTECTED_PATTERNS = [
    "unpack.py",
    "*.lock",
    "*.md",
    ".gitignore",
    ".repomixignore",
    ".shellcheckrc",
    ".chainlit/**/*",
    "pyproject.toml",
    "pyrightconfig.json",
    ".githooks/**/*",
    "agent/**/*",
]


def is_protected_file(path: str) -> bool:
    """パスが PROTECTED_PATTERNS のいずれかにマッチするか判定する"""
    normalized_path = path.replace("\\", "/")

    for pattern in PROTECTED_PATTERNS:
        normalized_pattern = pattern.replace("\\", "/")
        if fnmatch.fnmatch(normalized_path, normalized_pattern):
            return True
    return False


def merge_protected_blocks(old_content: str, new_content: str) -> str:
    """既存コード(old_content)に含まれる @lock-start 〜 @lock-end ブロックを抽出し、
    生成コード(new_content)内の対応する同ブロックを既存コードで強制的に復元する。
    """
    pattern = re.compile(r"(^[^\n]*?@lock-start[\s\S]*?@lock-end[^\n]*)", re.MULTILINE)

    old_blocks = pattern.findall(old_content)
    if not old_blocks:
        return new_content

    block_iter = iter(old_blocks)

    def replace_callback(match):
        try:
            return next(block_iter)
        except StopIteration:
            return match.group(0)

    return pattern.sub(replace_callback, new_content)


def unpack_files(input_file_path: str, dry_run: bool = False):
    if not os.path.exists(input_file_path):
        print(f"❌ エラー: 入力ファイル '{input_file_path}' が見つかりません。")
        return

    with open(input_file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # <file path="...">...</file> を抽出する正規表現
    pattern = re.compile(r'<file path="([^"]+)">([\s\S]*?)</file>')
    matches = pattern.findall(content)

    if not matches:
        print("⚠️ 警告: 抽出対象の <file path='...'> タグが見つかりませんでした。")
        return

    if dry_run:
        print("🔍 === DRY-RUN MODE (ファイルの変更は行われません) ===")

    protected_skipped_files = []
    no_change_files = []
    updated_files = []
    created_files = []

    for path, code in matches:
        code = code.strip()
        prefix = "[DRY-RUN] " if dry_run else ""

        # 1. globパターンによる完全保護チェック
        if is_protected_file(path):
            protected_skipped_files.append(path)
            print(f"🔒 {prefix}Skipped (保護パターンにマッチ): {path}")
            continue

        final_code = code

        # 既存ファイルが存在する場合の処理
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as existing_f:
                existing_code = existing_f.read().strip()

            # 2. ブロック単位の保護（@lock-start 〜 @lock-end の復元）
            final_code = merge_protected_blocks(existing_code, code).strip()

            # 3. 差分（diff）チェック：変更がなければ書き込みをスキップ
            if existing_code == final_code:
                no_change_files.append(path)
                print(f"⚪ {prefix}Skipped (変更なし): {path}")
                continue

            status = "Updated"
            updated_files.append(path)
        else:
            status = "Created"
            created_files.append(path)

        # dry-run の場合はファイル書き込みを行わない
        if not dry_run:
            dirname = os.path.dirname(path)
            if dirname:
                os.makedirs(dirname, exist_ok=True)

            with open(path, "w", encoding="utf-8") as out_f:
                out_f.write(final_code + "\n")

            print(f"✅ {status}: {path}")
        else:
            print(f"📝 {prefix}Would be {status}: {path}")

    # 集計結果（サマリー）を表示
    print("\n" + "=" * 50)
    print("📊 実行サマリー" + (" (DRY-RUN)" if dry_run else ""))
    print("=" * 50)
    print(
        f"🔒 保護パターンによりスキップされるファイル ({len(protected_skipped_files)} 件):"
    )
    if protected_skipped_files:
        for f in protected_skipped_files:
            print(f"   - {f}")
    else:
        print("   (対象なし)")

    print(f"\n⚪ 変更なしでスキップ: {len(no_change_files)} 件")
    print(f"📝 更新/作成予定: {len(updated_files) + len(created_files)} 件")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="LLMの生成コード(XML)をファイルシステムへ展開・書き込みします。"
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        default="cloud-output.xml",
        help="対象のXMLファイルパス (デフォルト: cloud-output.xml)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際の書き込みを行わず、保護スキップ対象や更新予定ファイルをプレビューします。",
    )

    args = parser.parse_args()
    unpack_files(args.input_file, dry_run=args.dry_run)
