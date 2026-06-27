#!/usr/bin/env sh
set -eu

name="$(sh scripts/portless-name.sh kino)"

export PORTLESS_PORT="${PORTLESS_PORT:-1355}"

# Ensure the shared portless proxy is running BEFORE registering this worktree's
# route.
#
#   - Proxy already up  -> do nothing; just register our route and share it.
#   - Proxy not up      -> start it, so we and every later worktree share one proxy.
#
# When we have to start it, we start it from the GLOBAL portless install (not this
# worktree's local copy) and from a neutral working directory, so the daemon's
# command line carries no worktree path. That keeps the proxy "owned by nobody":
# no worktree's dev cleanup can match and kill it, so starting or stopping one
# worktree never disturbs another. The proxy is shared infrastructure; each
# `pnpm dev` only ever brings up its OWN Convex/Vite and registers a route.
proxy_is_up() {
  curl -sk -o /dev/null --max-time 2 "https://127.0.0.1:${PORTLESS_PORT}/" 2>/dev/null
}

if ! proxy_is_up; then
  # Prefer the global install so the daemon isn't tied to any worktree's folder.
  global_root="$(npm root -g 2>/dev/null || true)"
  global_cli="${global_root}/portless/dist/cli.js"
  if [ -n "${global_root}" ] && [ -f "${global_cli}" ]; then
    (cd "${HOME}" && node "${global_cli}" proxy start --https --skip-trust >/dev/null 2>&1 &)
  else
    # Fallback: let whatever `portless` is on PATH start it. Still a shared proxy;
    # just not started from a guaranteed-neutral path.
    (cd "${HOME}" && portless proxy start --https --skip-trust >/dev/null 2>&1 &)
  fi

  # Wait for it to listen, regardless of which worktree won a concurrent start.
  i=0
  while [ "${i}" -lt 20 ]; do
    if proxy_is_up; then
      break
    fi
    i=$((i + 1))
    sleep 0.3
  done
fi

exec portless "$name" --force "$@"
