#!/usr/bin/env sh
set -eu

base_name="${1:-kino}"

sanitize() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//'
}

if [ -n "${PORTLESS_NAME:-}" ]; then
  printf '%s\n' "$PORTLESS_NAME"
  exit 0
fi

top_level="$(pwd -P)"
git_dir=""

if command -v git >/dev/null 2>&1; then
  top_level="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
  git_dir="$(git rev-parse --absolute-git-dir 2>/dev/null || true)"
fi

name="$(sanitize "$base_name")"

case "$git_dir" in
  */.git/worktrees/*)
    worktree_name="$(sanitize "$(basename "$top_level")")"
    if [ -n "$worktree_name" ]; then
      name="${worktree_name}.${name}"
    fi
    ;;
esac

printf '%s\n' "$name"
