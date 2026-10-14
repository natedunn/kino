#!/usr/bin/env sh
set -eu

script_dir="$(dirname "$0")"
branch="${1:-}"
max_length="${2:-48}"

if [ -z "$branch" ]; then
  . "$script_dir/lib/detect-branch.sh"
fi

node "$script_dir/lib/preview-name.mjs" "$branch" "$max_length"
