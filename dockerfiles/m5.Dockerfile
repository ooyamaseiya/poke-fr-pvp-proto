# 不整合を防ぐため、cpp向けのベースイメージはハードコードに戻す
FROM mcr.microsoft.com/devcontainers/cpp:trixie

# FROM以後にARGを宣言してビルド引数を利用可能にする
ARG NODE_MAJOR_VERSION=22
ARG PIO_LIBRARIES="m5stack/M5Unified"
ARG GITLEAKS_VERSION=8.30.0
ARG GH_VERSION=2.62.0

# ユーザー非依存の共有パスを設定（GUI関連環境変数は実行時docker-compose側へ移行）
ENV PLATFORMIO_CORE_DIR=/opt/platformio
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# 1. システムパッケージ（Python / USB / GUI・VNC関連 / Node.js）を一括導入
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-pip \
       python3-venv \
       udev \
       usbutils \
       curl \
       ca-certificates \
       libsdl2-dev \
       xvfb \
       imagemagick \
       x11vnc \
       novnc \
       websockify \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    # 実行ユーザーに関わらず XDG_RUNTIME_DIR をマウントできるよう汎用ディレクトリ作成
    && mkdir -p /tmp/runtime-root && chmod 777 /tmp/runtime-root

# 2. 共有Python仮想環境（/opt/venv）に PlatformIO CLI と pyserial を導入
RUN python3 -m venv ${VIRTUAL_ENV} \
    && pip install --no-cache-dir --upgrade pip uv \
    && uv pip install --no-cache \
       platformio \
       pyserial \
    && chmod -R a+rwX ${VIRTUAL_ENV}

# 3. 共通CLIツール（repomix / opencode）をグローバルパスへ導入
RUN npm install -g repomix \
    && curl -fsSL https://opencode.ai/v2/install | bash \
    && mv /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && rm -rf /root/.opencode

# 4. gitleaks と gh (GitHub CLI) のインストール（全ユーザーから使えるよう /usr/local/bin へ配置）
RUN ARCH=$(dpkg --print-architecture) \
    && case "${ARCH}" in \
         amd64) GITLEAKS_ARCH="x64"; GH_ARCH="amd64" ;; \
         arm64) GITLEAKS_ARCH="arm64"; GH_ARCH="arm64" ;; \
         *) echo "Unsupported architecture: ${ARCH}" && exit 1 ;; \
       esac \
    && curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GITLEAKS_ARCH}.tar.gz" \
       -o /tmp/gitleaks.tar.gz \
    && tar -xzf /tmp/gitleaks.tar.gz -C /usr/local/bin gitleaks \
    && chmod 755 /usr/local/bin/gitleaks \
    && rm -f /tmp/gitleaks.tar.gz \
    && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${GH_ARCH}.tar.gz" \
       -o /tmp/gh.tar.gz \
    && tar -xzf /tmp/gh.tar.gz -C /tmp \
    && mv /tmp/gh_${GH_VERSION}_linux_${GH_ARCH}/bin/gh /usr/local/bin/gh \
    && chmod 755 /usr/local/bin/gh \
    && rm -rf /tmp/gh.tar.gz /tmp/gh_${GH_VERSION}_linux_${GH_ARCH}

# 5. 必須ライブラリをグローバル領域に焼き込む（スペース区切りで複数指定に対応）
RUN if [ -n "${PIO_LIBRARIES}" ]; then \
      for lib in ${PIO_LIBRARIES}; do \
        pio pkg install -g --library "${lib}"; \
      done; \
    fi

# 6. ダミープロジェクトでESP32 / ESP32-S3のツールチェーン＆フレームワークを焼き込む
RUN mkdir -p /tmp/pio-warmup/src \
    && printf '%s\n' \
      '[env:m5stack-core2]' \
      'platform = espressif32' \
      'board = m5stack-core2' \
      'framework = arduino' \
      '' \
      '[env:m5stack-cores3]' \
      'platform = espressif32' \
      'board = m5stack-cores3' \
      'framework = arduino' \
      > /tmp/pio-warmup/platformio.ini \
    && printf '%s\n' \
      '#include <M5Unified.h>' \
      'void setup() { M5.begin(); }' \
      'void loop() {}' \
      > /tmp/pio-warmup/src/main.cpp \
    && pio run -d /tmp/pio-warmup \
    && rm -rf /tmp/pio-warmup \
    && chmod -R a+rwX ${PLATFORMIO_CORE_DIR}
