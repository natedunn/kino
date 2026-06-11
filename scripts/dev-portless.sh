#!/usr/bin/env sh
set -eu

name="$(sh scripts/portless-name.sh kino)"

export PORTLESS_PORT="${PORTLESS_PORT:-1355}"

exec portless "$name" --force "$@"
