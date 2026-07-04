#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export CLOUD189_TOKEN_DIR="${CLOUD189_TOKEN_DIR:-$SCRIPT_DIR/.token}"

if [ ! -d node_modules ]; then
  npm install
fi

npm start
