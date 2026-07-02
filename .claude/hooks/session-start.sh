#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

INSTALL_DIR="$HOME/.local/bin"

if [ ! -x "$INSTALL_DIR/rtk" ] && ! command -v rtk >/dev/null 2>&1; then
  if ! curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh; then
    echo "Warning: failed to install rtk; continuing without it" >&2
  fi
fi

echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$CLAUDE_ENV_FILE"
