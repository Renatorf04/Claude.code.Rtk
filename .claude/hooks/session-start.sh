#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

INSTALL_DIR="$HOME/.local/bin"

if [ ! -x "$INSTALL_DIR/rtk" ] && ! command -v rtk >/dev/null 2>&1; then
  if ! curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh; then
    echo "Warning: prebuilt rtk install failed; trying 'cargo install --git' instead" >&2
    if command -v cargo >/dev/null 2>&1; then
      cargo install --git https://github.com/rtk-ai/rtk --locked || \
        echo "Warning: failed to install rtk; continuing without it" >&2
    else
      echo "Warning: cargo not available; continuing without rtk" >&2
    fi
  fi
fi

echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$CLAUDE_ENV_FILE"
