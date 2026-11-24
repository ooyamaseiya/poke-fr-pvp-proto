#!/usr/bin/env bash
set -euo pipefail

# 1. コンテナ起動時にマウントされたルート証明書をシステムに反映
if command -v sudo >/dev/null 2>&1; then
    sudo update-ca-certificates
else
    update-ca-certificates
fi

echo "[post-create] CA certificates updated successfully."

# 2. Git リポジトリ内で .githooks が存在する場合、gitleaks 用の pre-commit フックを有効化
if [[ -d ".githooks" ]]; then
    chmod +x .githooks/* 2>/dev/null || true

    # コンテナ実行ユーザーとホスト側ディレクトリ所有者が異なる場合の dubious ownership 対策
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git config --global --add safe.directory "$(pwd)" 2>/dev/null || true
    fi

    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git config --local core.hooksPath .githooks
        echo "[post-create] Git hooks path configured to .githooks (gitleaks pre-commit enabled)."
    else
        echo "[post-create] Warning: Not a git repository yet. Run 'git init && git config --local core.hooksPath .githooks' to enable gitleaks hook."
    fi
fi
