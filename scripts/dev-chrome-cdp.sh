#!/usr/bin/env bash
set -euo pipefail

CDP_PORT="${CDP_PORT:-9222}"
CDP_PROFILE="${CDP_PROFILE:-$HOME/.kino/chrome-cdp-profile}"
DEFAULT_URL="${DEFAULT_URL:-https://sidebar-toggle-data-loss.kino.localhost:1355}"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

mkdir -p "$CDP_PROFILE"

URL="${1:-$DEFAULT_URL}"
ARGS=(
  "--remote-debugging-port=$CDP_PORT"
  "--user-data-dir=$CDP_PROFILE"
  "$URL"
)

if [[ "$OSTYPE" == "darwin"* ]] && command -v open >/dev/null 2>&1; then
  open -na "Google Chrome" --args "${ARGS[@]}"
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome "${ARGS[@]}" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium "${ARGS[@]}" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser "${ARGS[@]}" >/dev/null 2>&1 &
else
  cat >&2 <<EOF
Unable to launch a CDP browser.

Install Google Chrome or Chromium, or launch one manually with:
  --remote-debugging-port=$CDP_PORT --user-data-dir="$CDP_PROFILE"
EOF
  exit 1
fi

cat <<EOF
Chrome CDP launched.

Profile: $CDP_PROFILE
Version: http://localhost:$CDP_PORT/json/version
Targets: http://localhost:$CDP_PORT/json/list
EOF
