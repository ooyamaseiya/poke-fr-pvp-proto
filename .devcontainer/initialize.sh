#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".devcontainer/.env"
ENV_EXAMPLE_FILE=".devcontainer/.env.example"

# 1. .env が未作成で .env.example がある場合は初期コピー
if [[ ! -f "$ENV_FILE" && -f "$ENV_EXAMPLE_FILE" ]]; then
  cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
fi
touch "$ENV_FILE"

# 2. IPv4 名前解決ヘルパー（Linux / macOS 対応）
resolve_ipv4() {
  local host="$1"
  if command -v getent >/dev/null 2>&1; then
    getent ahostsv4 "$host" 2>/dev/null | awk '{print $1; exit}'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import socket; print(socket.gethostbyname('$host'))" 2>/dev/null || true
  fi
}

# 3. .env の特定キーだけを安全に更新・追記する関数（他の行は維持）
upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"

  awk -v k="$key" -v v="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" k "=" { print k "=" v; found = 1; next }
    { print }
    END { if (!found) print k "=" v }
  ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
}

# 4. INFER_HOST の名前解決と .env への反映
# .env から INFER_HOST を取得、なければデフォルト値を使用
INFER_HOST=$(grep "^INFER_HOST=" "$ENV_FILE" | cut -d '=' -f2 || echo "dev-infer.local")
resolved_ip=$(resolve_ipv4 "$INFER_HOST")
resolved_ip="${resolved_ip:-127.0.0.1}"

upsert_env "DEV_INFER_IP" "$resolved_ip" "$ENV_FILE"
echo "[init] DEV_INFER_IP=${resolved_ip} (${INFER_HOST})"

# 5. OSに応じたデフォルトのCaddyルート証明書パスを設定
if [[ "$(uname -s)" == "Darwin" ]]; then
    DEFAULT_CERT_PATH="${HOME}/Library/Application Support/Caddy/pki/authorities/local/root.crt"
else
    DEFAULT_CERT_PATH="/etc/caddy/certs/ca.crt"
fi

# .env に HOST_CA_CERT_PATH が定義されていない、またはコメントアウトされている場合は追記
if ! grep -q "^HOST_CA_CERT_PATH=" "$ENV_FILE"; then
    upsert_env "HOST_CA_CERT_PATH" "$DEFAULT_CERT_PATH" "$ENV_FILE"
    echo "[init] HOST_CA_CERT_PATH auto-configured for $(uname -s)"
fi

# 6. プロジェクト名の動的設定
upsert_env "PROJECT_NAME" "${PROJECT_NAME:-$(basename "$PWD")}" "$ENV_FILE"

# 7. Git リポジトリ初期化済みの場合、ホスト側でも .githooks を有効化
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [[ -d ".githooks" ]]; then
  chmod +x .githooks/* 2>/dev/null || true
  git config --local core.hooksPath .githooks
  echo "[init] Git hooks path configured to .githooks"
fi
