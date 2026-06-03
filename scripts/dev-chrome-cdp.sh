#!/usr/bin/env bash
set -euo pipefail

CDP_PORT="${CDP_PORT:-9222}"
CDP_PROFILE="${CDP_PROFILE:-$HOME/.kino/chrome-cdp-profile}"
DEFAULT_URL="${DEFAULT_URL:-https://sidebar-toggle-data-loss.kino.localhost:1355}"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

mkdir -p "$CDP_PROFILE"

open -na "Google Chrome" --args \
  --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$CDP_PROFILE" \
  "${1:-$DEFAULT_URL}"

cat <<EOF
Chrome CDP launched.

Profile: $CDP_PROFILE
Version: http://localhost:$CDP_PORT/json/version
Targets: http://localhost:$CDP_PORT/json/list
EOF
