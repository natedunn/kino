# Kino Files delivery Worker

This Worker owns `files.usekino.com` and streams public project assets from the
private organization-upload R2 bucket. Development and preview assets use
`files-preview.usekino.com` once the shared preview Worker is deployed. Local
development falls back to signed R2 URLs.

Like `workers/gateway`, this package is standalone infrastructure. It is not
deployed by the Git-connected `kino` application build: Cloudflare pins that
build's credential and Worker name to `kino`, so a nested Wrangler command
cannot safely create or update sibling Workers. Deploy this package explicitly
when its source or configuration changes.

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
pnpm deploy:preview
curl https://files-preview.usekino.com/health

pnpm deploy:production
curl https://files.usekino.com/health
```

Cloudflare creates the DNS record and certificate from the Wrangler custom
domain declaration. Before the first production deployment, verify that
`kino-prod-org-uploads` is the production organization-upload bucket; the
development bucket is `kino-dev-org-uploads`.

Set the Convex `FILES_ORIGIN` environment variable alongside the deployment:

- Shared preview deployments, after the Worker is live: `https://files-preview.usekino.com`
- Production: `https://files.usekino.com`

When `FILES_ORIGIN` is unset, assets that already satisfy the current public ID
and deterministic object-key contract use authorized, short-lived signed R2
delivery. Legacy public objects do not receive this fallback. Private and
unlisted assets retain their authorized, short-lived signed delivery path. Set
the variable only after the corresponding Worker is deployed and healthy;
production configuration must set the production value explicitly.

Do not add application session cookies to this hostname. Public delivery uses
cross-origin-safe responses; future private delivery must use a separate,
short-lived authorization mechanism and must not be publicly cached.
