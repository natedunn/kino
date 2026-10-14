# Sourced (`. scripts/lib/detect-branch.sh`) by the build/preview scripts.
# Sets `branch` from the CI environment, then the checked-out Git branch, then
# the `preview` fallback. Anything other than the production branch is treated
# as a preview, so the fallback must never be the production branch name.
# Workers Builds sets WORKERS_CI_BRANCH; BRANCH is a manual override.
branch="${WORKERS_CI_BRANCH:-${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-${BRANCH:-}}}}"
if [ -z "$branch" ] && command -v git >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
branch="${branch:-preview}"
