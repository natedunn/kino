# Gateway Setup Checklist (dev tier)

How this works: **Step 0 creates one gitignored file —
`workers/gateway/secrets.dev.local` — that holds every secret under its real
env var name.** Steps 1–2 (GitHub UI) fill in the blanks in that file. Steps
3–5 are copy-paste command blocks that read from it. You never label, rename,
or manually re-type a secret.

Step IDs (1a, 3c, …) are stable — reference them when asking questions.

## Naming scheme

| Name | What it is | Env prefix |
|---|---|---|
| **Kino Auth** | GitHub **OAuth app** — user login | `GITHUB_AUTH_*` |
| **Kino Relay** | **GitHub App** — org/repo sync + webhooks | `GITHUB_RELAY_*` |
| **Gateway** | Cloudflare Worker fronting both, `gateway-dev.usekino.com` | `GATEWAY_*` |

Same env var names in every environment; only the values differ per tier.
Everything below is dev-tier only — production is untouched until Step 7.

---

## Step 0 — Create the secrets file (terminal, repo root)

- [ ] **0a** Run this once. It generates the five random secrets and leaves
      blanks for the GitHub values you'll collect in Steps 1–2:

```sh
cat > workers/gateway/secrets.dev.local <<EOF
# Dev-tier secrets for the gateway + Convex. Gitignored — never commit.
export OAUTH_PROXY_SECRET="$(openssl rand -hex 32)"
export GITHUB_RELAY_STATE_SECRET="$(openssl rand -hex 32)"
export GITHUB_RELAY_WEBHOOK_SECRET="$(openssl rand -hex 32)"
export GATEWAY_ADMIN_TOKEN="$(openssl rand -hex 32)"
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"

# --- Fill these in during Step 1 (Kino Auth Dev OAuth app) ---
export GITHUB_AUTH_CLIENT_ID=""
export GITHUB_AUTH_CLIENT_SECRET=""

# --- Fill these in during Step 2 (Kino Relay Dev GitHub App) ---
export GITHUB_RELAY_APP_ID=""
export GITHUB_RELAY_CLIENT_ID=""
export GITHUB_RELAY_CLIENT_SECRET=""
export GITHUB_RELAY_SLUG=""
# Absolute path to the downloaded .pem private key file:
export GITHUB_RELAY_PRIVATE_KEY_PATH=""
EOF
```

This file is the single source of truth for the dev tier. Open it in your
editor now and keep it open — Steps 1 and 2 paste values into it.

---

## Step 1 — Create the "Kino Auth Dev" OAuth app (GitHub UI)

User **login**. A NEW app; the existing prod OAuth app is not modified.

- [ ] **1a** Go to <https://github.com/settings/developers> → **OAuth Apps** →
      **New OAuth App**. (If the prod OAuth app is org-owned, use that org's
      Settings → Developer settings → OAuth Apps instead.)
- [ ] **1b** Fill in:
      - Application name: `Kino Auth Dev`
      - Homepage URL: `https://usekino.com`
      - Authorization callback URL:
        `https://gateway-dev.usekino.com/api/auth/callback/github`
- [ ] **1c** Register. Copy the **Client ID** into
      `GITHUB_AUTH_CLIENT_ID=""` in the secrets file.
- [ ] **1d** Click **Generate a new client secret** (shown once). Copy it into
      `GITHUB_AUTH_CLIENT_SECRET=""` in the secrets file.

---

## Step 2 — Create the "Kino Relay Dev" GitHub App (GitHub UI)

Org/repo **sync + webhooks**. A NEW app; prod app untouched. Open the existing
prod GitHub App's settings in a second tab as reference:
<https://github.com/settings/apps> (or org equivalent) → your app → Edit.

- [ ] **2a** Go to <https://github.com/settings/apps/new> (or
      `https://github.com/organizations/<org>/settings/apps/new` if the prod
      app is org-owned — create the dev app in the same place).
- [ ] **2b** GitHub App name: `Kino Relay Dev`. Homepage:
      `https://usekino.com`.
- [ ] **2c** Callback URL:
      `https://gateway-dev.usekino.com/github-relay/oauth-callback`
- [ ] **2d** Match these toggles to the prod app (reference tab):
      - "Expire user authorization tokens"
      - "Request user authorization (OAuth) during installation"
      - Leave "Setup URL" blank.
- [ ] **2e** Webhook: Active ✅. URL:
      `https://gateway-dev.usekino.com/hooks/github`. Secret: print it with
      ```sh
      grep GITHUB_RELAY_WEBHOOK_SECRET workers/gateway/secrets.dev.local
      ```
      and paste the value into GitHub's "Webhook secret" field. (The URL won't
      resolve until Step 3 — fine, GitHub doesn't check at registration.)
- [ ] **2f** Repository permissions: Issues **Read and write**, Discussions
      **Read and write**, Metadata Read-only (auto-selected).
- [ ] **2g** Subscribe to events: Issues, Issue comment, Discussion,
      Discussion comment.
- [ ] **2h** "Where can this app be installed?" → **Any account**.
- [ ] **2i** Click **Create GitHub App**. Then, from the app's General page,
      fill in the secrets file:
      - **App ID** (top of page) → `GITHUB_RELAY_APP_ID`
      - **Client ID** → `GITHUB_RELAY_CLIENT_ID`
      - **Generate a new client secret** → `GITHUB_RELAY_CLIENT_SECRET`
      - **Generate a private key** → downloads a `.pem`; put its absolute path
        in `GITHUB_RELAY_PRIVATE_KEY_PATH`
      - The **slug** from the page URL (`…/settings/apps/<slug>`) →
        `GITHUB_RELAY_SLUG`

Every blank in the secrets file should now be filled. Do NOT install the app
on any org yet — that's Step 6, through Kino's own UI.

---

## Step 3 — Deploy the gateway Worker (terminal)

- [ ] **3a** Install deps:
      ```sh
      cd workers/gateway && pnpm install
      ```
- [ ] **3b** Create the KV namespace:
      ```sh
      npx wrangler kv namespace create TARGETS --env dev
      ```
      Copy the `id` it prints into `wrangler.jsonc`, replacing
      `REPLACE_WITH_DEV_KV_ID`.
- [ ] **3c** First deploy, then push all seven secrets straight from the
      secrets file (no typing):
      ```sh
      pnpm deploy:dev
      source secrets.dev.local
      echo "$OAUTH_PROXY_SECRET"          | npx wrangler secret put OAUTH_PROXY_SECRET --env dev
      echo "$BETTER_AUTH_SECRET"          | npx wrangler secret put BETTER_AUTH_SECRET --env dev
      echo "$GITHUB_AUTH_CLIENT_ID"       | npx wrangler secret put GITHUB_AUTH_CLIENT_ID --env dev
      echo "$GITHUB_AUTH_CLIENT_SECRET"   | npx wrangler secret put GITHUB_AUTH_CLIENT_SECRET --env dev
      echo "$GITHUB_RELAY_STATE_SECRET"   | npx wrangler secret put GITHUB_RELAY_STATE_SECRET --env dev
      echo "$GITHUB_RELAY_WEBHOOK_SECRET" | npx wrangler secret put GITHUB_RELAY_WEBHOOK_SECRET --env dev
      echo "$GATEWAY_ADMIN_TOKEN"         | npx wrangler secret put GATEWAY_ADMIN_TOKEN --env dev
      ```
- [ ] **3d** Deploy again so the Worker picks everything up, and confirm the
      `gateway-dev.usekino.com` custom domain attaches (the usekino.com zone
      must be on your Cloudflare account; approve the DNS record if prompted):
      ```sh
      pnpm deploy:dev
      ```
- [ ] **3e** Verify:
      ```sh
      curl https://gateway-dev.usekino.com/health
      ```
      → `{"ok":true,"service":"kino-gateway"}`

---

## Step 4 — Point local dev at the dev tier (terminal, repo root)

> Your local Convex dev deployment already uses the new env var *names* — this
> replaces the *values* (it currently still holds prod-app credentials).

- [ ] **4a** Push everything to the local Convex dev deployment from the
      secrets file:
      ```sh
      source workers/gateway/secrets.dev.local
      npx convex env set OAUTH_PROXY_SECRET "$OAUTH_PROXY_SECRET"
      npx convex env set OAUTH_PROXY_PRODUCTION_URL https://gateway-dev.usekino.com
      npx convex env set GITHUB_AUTH_CLIENT_ID "$GITHUB_AUTH_CLIENT_ID"
      npx convex env set GITHUB_AUTH_CLIENT_SECRET "$GITHUB_AUTH_CLIENT_SECRET"
      npx convex env set GITHUB_RELAY_APP_ID "$GITHUB_RELAY_APP_ID"
      npx convex env set GITHUB_RELAY_CLIENT_ID "$GITHUB_RELAY_CLIENT_ID"
      npx convex env set GITHUB_RELAY_CLIENT_SECRET "$GITHUB_RELAY_CLIENT_SECRET"
      npx convex env set -- GITHUB_RELAY_PRIVATE_KEY "$(cat "$GITHUB_RELAY_PRIVATE_KEY_PATH")"
      npx convex env set GITHUB_RELAY_SLUG "$GITHUB_RELAY_SLUG"
      npx convex env set GITHUB_RELAY_STATE_SECRET "$GITHUB_RELAY_STATE_SECRET"
      npx convex env set GITHUB_RELAY_WEBHOOK_SECRET "$GITHUB_RELAY_WEBHOOK_SECRET"
      ```
      (The `--` on the private-key line is required — the PEM starts with a
      dash and the CLI would parse it as a flag.)
- [ ] **4b** Wire the scripts to the gateway:
      ```sh
      source workers/gateway/secrets.dev.local
      printf 'GATEWAY_URL=https://gateway-dev.usekino.com\nGATEWAY_ADMIN_TOKEN=%s\n' "$GATEWAY_ADMIN_TOKEN" >> .env.local
      ```

---

## Step 5 — Make previews inherit the same config (dashboards)

- [ ] **5a** Convex dashboard → project **kino** → Settings → **Environment
      Variables** → preview deployment defaults: add the same 11 vars from 4a.
      To see name=value pairs for pasting:
      ```sh
      cat workers/gateway/secrets.dev.local
      ```
      (`GITHUB_RELAY_PRIVATE_KEY` is the *contents* of the `.pem` file, and
      `OAUTH_PROXY_PRODUCTION_URL` is `https://gateway-dev.usekino.com`.)
- [ ] **5b** Cloudflare dashboard → Workers Builds config for `kino` → add
      build env vars (they apply to all branches; `scripts/cloudflare-build.sh`
      routes the `_PREVIEW` variants to non-production builds only):
      - `GATEWAY_URL_PREVIEW` = `https://gateway-dev.usekino.com`
      - `GATEWAY_ADMIN_TOKEN_PREVIEW` = the `GATEWAY_ADMIN_TOKEN` value from
        the secrets file

---

## Step 6 — Test everything, prod never involved

- [ ] **6a** Registry: run `pnpm dev`, look for "Registered gateway webhook
      target" in the output. Verify:
      ```sh
      source workers/gateway/secrets.dev.local
      curl -H "Authorization: Bearer $GATEWAY_ADMIN_TOKEN" https://gateway-dev.usekino.com/hooks/targets
      ```
      → your `…convex.site/api/github/webhook` URL is listed.
- [ ] **6b** Login: open `https://<worktree>.kino.localhost:1355/auth` in a
      fresh browser session → GitHub sign-in. The GitHub authorize page URL
      should contain `redirect_uri=https://gateway-dev.usekino.com/...`. You
      should land back on your worktree, signed in.
- [ ] **6c** Sync connect: in Kino, org settings → integrations → connect
      GitHub. You should be sent to install **Kino Relay Dev**, then bounce
      back through `gateway-dev` to your worktree with `?github=connected`.
- [ ] **6d** Webhooks: GitHub → Kino Relay Dev app settings → **Advanced** →
      Recent Deliveries → latest delivery shows response `202` (the gateway).
      Convex dashboard → Data → `githubWebhookDelivery` has rows. Suspend +
      unsuspend the installation from GitHub's install settings page and watch
      `githubInstallation.status` flip.
- [ ] **6e** Preview: push this branch, open the preview URL, repeat 6b–6d.

---

## Step 7 — Prod cutover (LATER, only after Step 6 is fully green)

Summary only — ask for a detailed walkthrough when you get here. There are
**no legacy env fallbacks** in the code, so 7c must land together with the
first prod deploy of this branch.

- [ ] **7a** Create `workers/gateway/secrets.production.local` the same way
      (reuse prod's existing OAuth proxy secret + GitHub creds; fresh
      `GATEWAY_ADMIN_TOKEN` + `BETTER_AUTH_SECRET`).
- [ ] **7b** KV namespace + secrets + `pnpm deploy:production`
      (`gateway.usekino.com`).
- [ ] **7c** Rename prod Convex env vars to the new names (`GITHUB_AUTH_*`,
      `GITHUB_RELAY_*`) and set
      `OAUTH_PROXY_PRODUCTION_URL=https://gateway.usekino.com`.
- [ ] **7d** Edit the **existing prod** OAuth app + GitHub App: point callback
      URL / webhook URL at `gateway.usekino.com` (same paths as dev). Workers
      Builds env: `GATEWAY_URL_PRODUCTION` + `GATEWAY_ADMIN_TOKEN_PRODUCTION`.
- [ ] **7e** Verify prod login + sync, then remove the prod-origin
      special-casing from `src/lib/convex/auth-server.ts` (cleanup PR).
