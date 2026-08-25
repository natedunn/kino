#!/usr/bin/env sh
set -eu

# Cloudflare Workers Builds invokes this command for the production branch.
# Deploy the file-delivery tiers when their source changed, on their first run,
# or when a health check shows that either Worker is missing. A shallow checkout
# cannot prove that the files are unchanged, so it safely redeploys them.
files_worker_changed=1
files_worker_reason="the previous commit is unavailable"

if [ "${FORCE_FILES_WORKER_DEPLOY:-0}" = "1" ]; then
	files_worker_reason="FORCE_FILES_WORKER_DEPLOY is set"
elif git rev-parse --verify HEAD^ >/dev/null 2>&1; then
	if git diff --quiet HEAD^ HEAD -- workers/files; then
		files_worker_changed=0
		files_worker_reason=""
	else
		files_worker_reason="workers/files changed"
	fi
fi

deploy_files_worker() {
	environment="$1"
	health_url="$2"

	if [ "$files_worker_changed" = "1" ]; then
		echo "Deploying Files Worker ($environment): $files_worker_reason."
	elif ! command -v curl >/dev/null 2>&1; then
		echo "Deploying Files Worker ($environment): curl is unavailable for its health check."
	elif ! curl --fail --silent --show-error --max-time 10 "$health_url" >/dev/null; then
		echo "Deploying Files Worker ($environment): $health_url is not healthy."
	else
		echo "Skipping Files Worker ($environment): source is unchanged and $health_url is healthy."
		return
	fi

	if [ -z "${FILES_WORKERS_CLOUDFLARE_API_TOKEN:-}" ]; then
		echo "Missing required Cloudflare build secret: FILES_WORKERS_CLOUDFLARE_API_TOKEN." >&2
		echo "The Git-connected kino credential can deploy only the kino Worker; the Files Workers require a separate account-scoped token." >&2
		exit 1
	fi

	# Workers Builds pins its generated credential and Worker name to the
	# Git-connected kino Worker. Use the dedicated token for these intentional
	# sibling deployments, while leaving the generated credential untouched for
	# the main application deployment below.
	env -u WRANGLER_CI_OVERRIDE_NAME \
		CLOUDFLARE_API_TOKEN="$FILES_WORKERS_CLOUDFLARE_API_TOKEN" \
		pnpm exec wrangler deploy \
		--config workers/files/wrangler.jsonc \
		--env "$environment"
}

deploy_files_worker preview "https://files-preview.usekino.com/health"
deploy_files_worker production "https://files.usekino.com/health"

pnpm exec wrangler deploy --config dist/server/wrangler.json --keep-vars
