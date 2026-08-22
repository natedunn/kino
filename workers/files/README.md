# Kino Files delivery Worker

This Worker owns `files.usekino.com` and streams public project assets from the
private organization-upload R2 bucket. Development and preview assets use
`files-dev.usekino.com`.

It deliberately serves only deterministic public object namespaces:

- `PUBLIC_FILE.<publicId>` for originals.
- `PUBLIC_FILE_THUMBNAIL.<publicId>.webp` for 128 px thumbnails.

Private and user-uploaded objects never use those keys and are not reachable
through this Worker. Uploads continue to use short-lived presigned R2 URLs; only
delivery uses the clean Kino hostname.

## URL contract

```text
https://files.usekino.com/<publicId>/<display-filename.ext>
https://files.usekino.com/<publicId>/thumb-128.webp
```

The random public ID is authoritative. The trailing filename is presentation
metadata, so old links remain valid after a rename. Object metadata—not the URL
extension—controls the response content type. `?download=1` forces attachment
delivery.

## Development

```sh
cd workers/files
pnpm install
pnpm types
pnpm typecheck
pnpm test
pnpm dev
```

Always deploy and verify development before production:

```sh
pnpm deploy:dev
curl https://files-dev.usekino.com/health

pnpm deploy:production
curl https://files.usekino.com/health
```

Cloudflare creates the DNS record and certificate from the Wrangler custom
domain declaration. Before the first production deployment, verify that
`kino-org-uploads` is the production value of `R2_ORG_UPLOADS_BUCKET`; the
development bucket is `kino-dev-org-uploads`.

Set the Convex `FILES_ORIGIN` environment variable alongside the deployment:

- Development and preview, after the Worker is live: `https://files-dev.usekino.com`
- Production: `https://files.usekino.com`

When `FILES_ORIGIN` is unset, Convex falls back to authorized, short-lived R2
URLs. This keeps local and unconfigured preview deployments working before the
custom hostname exists. Set the variable only after the corresponding Worker
is deployed and healthy. Production configuration must set the production
value explicitly.

Do not add application session cookies to this hostname. Public delivery uses
cross-origin-safe responses; future private delivery must use a separate,
short-lived authorization mechanism and must not be publicly cached.
