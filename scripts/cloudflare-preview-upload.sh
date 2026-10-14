#!/usr/bin/env sh
set -eu

. "$(dirname "$0")/lib/detect-branch.sh"

alias_name="$(sh scripts/preview-name.sh "$branch" 40)"

if [ -z "${NATIVE_GITHUB_ROUTE_SECRET_PREVIEW:-}" ]; then
  echo "Native preview upload requires NATIVE_GITHUB_ROUTE_SECRET_PREVIEW." >&2
  exit 1
fi

# Worker Previews isolate runtime settings from production. Wrangler accepts a
# secrets file, so the route signing key never appears in a command argument or
# the checked-in Wrangler configuration.
secrets_file="$(mktemp)"
chmod 600 "$secrets_file"
trap 'rm -f "$secrets_file"' EXIT
NATIVE_PREVIEW_SECRETS_FILE="$secrets_file" node -e '
  const fs = require("node:fs");
  fs.writeFileSync(process.env.NATIVE_PREVIEW_SECRETS_FILE,
    JSON.stringify({ NATIVE_GITHUB_ROUTE_SECRET: process.env.NATIVE_GITHUB_ROUTE_SECRET_PREVIEW }));
'

npx wrangler preview --config dist/server/wrangler.json --name "$alias_name" --secrets-file "$secrets_file"
