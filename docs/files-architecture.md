# Files and storage architecture

Status: first-pass implementation contract. This document is the durable source
of truth for the Files feature until a later storage-tier RFC replaces the
limits section.

## Goals

Files is a project asset registry built on top of the existing Cloudflare R2
organization-upload and user-upload buckets. It is not only a page of manually
uploaded files. The registry must also represent assets attached by features
such as update covers, update body images, Wiki attachments, and future
integrations.

The design keeps four concerns separate:

1. A logical asset that may appear in the project Files library.
2. A physical object in R2, or a future external-provider pointer.
3. References describing where the asset is used.
4. Storage accounting and quota attribution.

This separation lets a hidden user attachment count against project storage
without making it public, and lets one asset be reused in several features
without counting its bytes more than once.

## Free-tier floor

The first pass treats every project as the floor/free tier:

- Project quota: **100 MiB**.
- Project-scoped staff and user uploads consume the same project quota.
- Account-global objects such as profile avatars are tracked separately and do
  not consume an unrelated project's quota.
- The first-pass organization report is the sum of project-attributed objects.
  Organization-global objects such as the organization avatar will be added as
  a separate reporting line later; there is no organization quota in this pass.
- External linked files have zero hosted bytes, even when their provider
  reports a size.

Quota is checked before issuing an upload URL using the declared size. The
uploaded object is checked again using R2 metadata before it becomes ready. A
replacement keeps the old object live and reserves the full declared size of
the candidate until validation succeeds; the old object is then released. A
future optimization may reserve only the positive size delta. Completion and
deletion must be idempotent so retries cannot drift usage.

Future paid tiers must be implemented behind a storage-policy resolver. Upload
procedures must not contain plan-name conditionals or duplicated numeric
limits.

## File and batch limits

- Feature images and avatars: 5 MiB (existing policy).
- Images, documents, text, and data: 10 MiB.
- Packages, design sources, MP4, and WebM: 25 MiB.
- Maximum files per direct-upload batch: 10.
- Maximum declared direct-upload batch size: 50 MiB.

The canonical extension, category, accepted MIME aliases, preview policy, and
limit live in `convex/shared/files.ts`. Both frontend preflight and Convex
authorization use that module. The server remains authoritative.

## Core records

### `fileAsset`

The logical project-scoped asset. It stores the display name, normalized name,
extension, category, folder, listing/access policy, creation method, immutable
origin feature, search text, creator, and created/edited timestamps.

New public project assets also receive an immutable, high-entropy `publicId`.
This is the only database identity exposed by public delivery URLs. Convex ids,
project ids, R2 object keys, and provider credentials are never placed in those
URLs. Public assets without a valid `publicId` and matching deterministic object
key are intentionally unavailable; this first pass does not support legacy
public delivery URLs. Test assets created before this contract should be
deleted and reuploaded.

Access and listing are intentionally independent:

- `access`: `public`, `project_staff`, or `private_user`.
- `listing`: `project_files`, `staff_only`, or `unlisted`.

Only `public + project_files + ready` assets appear in the public first-pass
Files page. Hidden user uploads still have asset and object records so staff
views can be added later without a migration.

### `fileObject`

The physical object or external pointer. Hosted rows store an R2 bucket kind,
object key, actual bytes and MIME type. State is `pending`, `ready`, `rejected`,
or `deleted`. External rows reserve provider identity fields and contribute
zero hosted bytes.

The object row is the accounting source of truth. Aggregate usage is a cached
projection, never the only evidence that an object exists.

Public raster images receive a system-generated 128×128 WebP thumbnail after
the primary object passes metadata validation. Thumbnail keys, status, MIME,
and bytes are recorded on the asset, but derivative bytes never enter project
quota or category/origin/uploader rollups. The Files table loads only these
bounded derivatives—never full originals—and retains the category icon as its
processing/error fallback.

### `fileReference`

An indexed, bounded row per use of an asset. It records a feature, entity type,
entity id and field. Deleting an asset with active references is rejected until
the feature replaces or detaches it.

### `fileFolder`

A project-scoped adjacency-list hierarchy. Direct uploads default to the
protected `Uploads` system folder. Feature folders such as `Updates`, `Wiki`,
and `Project assets` are created lazily and carry stable system keys.

Folder names are case-insensitively unique within a parent. A file has one
folder in the first pass; reuse is modeled with references, not duplicate
placements.

### `projectStorageUsage`

Current byte and file totals keyed by scope and reporting dimensions. Required
project dimensions are category, origin feature and uploader class. The
rollups power project and organization settings, while reconciliation can
rebuild them from ready `fileObject` rows.

## Upload lifecycle

1. A feature requests an upload intent with project, filename, declared MIME,
   size, origin, listing/access, and optional folder.
2. The server derives identity from the session, checks project authority,
   validates the policy, and reserves quota.
3. Pending asset/object records are created before a unique R2 presigned URL is
   returned.
4. The browser uploads directly to R2 and calls completion.
5. The R2 component synchronizes actual metadata.
6. The callback validates actual MIME and bytes. Success marks the object ready
   and commits usage; failure deletes the object and marks it rejected.
7. Each pending intent schedules its own bounded expiry cleanup.

Feature code must call the shared registration lifecycle rather than update R2
and counters independently.

## Workspace, search, and URLs

The searchable field combines the display name, extension, category, MIME,
origin labels, description/tags, and bounded extracted content for `.txt`,
`.md`, `.mdx`, `.csv`, and `.json`.

PDF and proprietary design-file extraction are deferred. Search is always
scoped by project, ready state, and listing/access before returning results.

The primary Files workspace is a routed, two-pane browser. Its left pane is a
reactive filesystem tree containing folders and lightweight file leaves, and
its right pane is either the selected folder's bounded file table or a selected
file's Preview/Details view. The tree query returns only identity, parent,
display name, and category for at most 500 visible files; it does not resolve
delivery URLs or preview metadata. Folder and file records stay in Convex; the
browser only owns presentation state such as extra tree branches a user
expanded during the session.

Canonical routes:

```text
/@org/project/files
/@org/project/files/folder/<folderId>
/@org/project/files/file/<fileId>?tab=details&folder=<parentFolderId>
/@org/project/files/search?q=brand&category=image&extension=png&source=kino&cursor=...
```

Defaults are omitted. Folder and file identities live in path segments so
navigation is shareable and browser Back/Forward restores the meaningful
selection. The optional `folder` query on a file route remembers which parent
tree branch should remain selected; `tab` remembers Preview versus Details.
Upload and new-folder dialogs may be deep-linked with `?action=upload` and
`?action=new-folder`, but are permission-gated when rendered.

Quick Search opens the project-wide Cmd+K file mode. Advanced Search has its
own route and stores text/category/extension/provider filters in the URL. Any
filter change resets its cursor. Empty search defaults to Date created
descending. Full-text search uses Convex relevance ordering.

Folders are an adjacency-list hierarchy (`parentFolderId`), while R2 remains a
flat object store. Moving files or folders only changes metadata and never
copies object bytes. Sibling folder names are case-insensitively unique. A
project may contain up to 500 folders with at most 12 nested levels; folder
moves reject cycles and any move that would push descendants beyond that depth.
System folders can be opened but cannot be renamed, moved, or deleted. A folder
must have no child folders or files before deletion.

## Permissions

- Public/project viewers may list and download public, project-listed assets.
- `canManageContent` may directly upload, create/rename folders, move/rename
  assets, and delete unreferenced assets.
- Feature-specific user uploads use that feature's participation permission,
  but are registered as `uploaderClass=user` and hidden by default.
- Project storage reporting is available to project managers.
- Organization storage reporting is restricted to organization owners/admins.
- Archived projects remain readable and reject all upload/management writes.

## Safe delivery and deletion

Stored URLs are never persisted. New public assets use Kino delivery URLs:

```text
https://files.usekino.com/<publicId>/<display-filename.ext>
https://files.usekino.com/<publicId>/thumb-128.webp
```

Preview deployments use `files-preview.usekino.com` once that shared Worker is
deployed and `FILES_ORIGIN` is explicitly configured. Local development uses
signed R2 delivery unless a delivery origin is explicitly configured. When the
variable is unset, assets that already satisfy the current `publicId` and
deterministic object-key contract use authorized, short-lived signed delivery
so local and unconfigured development remains usable. Legacy public objects do
not receive this fallback. Private and unlisted assets continue to use their
authorized, short-lived signed delivery path. The public id is authoritative
and the filename is presentation-only, so a stable URL continues to work after
a rename. The immutable extension and stored object metadata—not the requested
URL suffix—determine the response content type and disposition.

The dedicated `workers/files` Cloudflare Worker is the origin for these
hostnames. It streams from a private R2 binding and can address only the
deterministic `PUBLIC_FILE.<publicId>` and
`PUBLIC_FILE_THUMBNAIL.<publicId>.webp` namespaces. Only
`public + project_files + org_uploads` objects may receive those keys. Hidden
user files and private objects remain on non-public keys and use authorized,
short-lived signed delivery.

The Worker supports GET/HEAD, conditional requests, byte ranges, bounded edge
caching, CORS for public embeds, and `X-Content-Type-Options: nosniff`. Safe
images, basic browser video, text, and PDFs may render inline. SVG, archives,
design sources, and other active or proprietary formats are attachment-only.
`?download=1` forces attachment delivery for otherwise previewable formats.

Feature records store an asset reference or internal object key, never the
delivery URL. Renderers derive the current delivery URL. This keeps update
headers, body images, Wiki attachments, and future integrations portable if
the hostname or storage provider changes.

Deleting a referenced asset is rejected. Deleting an unreferenced hosted asset
removes its R2 object, releases quota once, and retains a small tombstone for
audit/reconciliation.

## Integrations

Provider credentials and sync cursors belong to each integration subsystem,
not to Files. Files stores normalized metadata plus stable external identifiers.
Adapters should eventually implement the conceptual operations:

```ts
interface FileSourceAdapter {
	provider: FileSourceProvider;
	importItem(input: unknown): Promise<ExternalFileDescriptor>;
	resolveAccessUrl(externalId: string): Promise<string>;
	refreshMetadata(externalId: string): Promise<void>;
	removeLink(externalId: string): Promise<void>;
}
```

Initial reserved providers are Kino/R2, GitHub, Google Drive, YouTube, and S3.
External entries can appear in folders and search without consuming hosted
storage.

## Analytics

The database inventory is authoritative. PostHog records adoption and visible
failure outcomes only: `file_uploaded`, `file_upload_failed`, and
`file_deleted`. Properties may include category, origin feature, creation
method, uploader class, provider, coarse size bucket and an enumerated failure
reason. Never send filenames, extracted content, search text, signed URLs, or
provider credentials.

## Rollout and reconciliation

The first pass connects new direct Files uploads and new update-cover uploads.
Update covers are registered in the protected Updates folder and count against
the project quota. Existing legacy covers without the stable public-delivery
metadata are intentionally not rendered and may be reuploaded.

Organization and profile avatars are account/global objects and remain on their
existing path in this pass; they must not be assigned to an arbitrary project.
Future project-scoped user attachments must use the shared registration helper,
the user-upload bucket, `uploaderClass=user`, and an unlisted/private access
policy. Those records count against the project quota even though they are not
returned by the Files list query.

Do not infer historical bytes from the old `orgStorageUsage` counter; it may
have drifted on overwrites. This first pass does not reconcile legacy public
uploads into the Files delivery contract.

## First-pass implementation map

- Policy, format classification, and tier seam: `convex/shared/files.ts`.
- Asset registration and system-folder reuse: `convex/lib/file-registry.ts`.
- Atomic quota reservations and reporting rollups: `convex/lib/file-usage.ts`.
- Files API, full-text search, text extraction, and management operations:
  `convex/functions/file.ts`.
- Routed workspace shell and folder tree: `src/routes/@{$org}/$project/files/route.tsx`
  and `files/-components/folder-tree.tsx`.
- Folder explorer, preview/details, and advanced search:
  `src/routes/@{$org}/$project/files/-components/file-explorer.tsx`,
  `files/file/$fileId/index.tsx`, and `files/search/index.tsx`.
- The previous table-centric implementation is temporarily retained at the
  unlinked `/@org/project/asset-library` route for comparison during this PR.
- Update-cover adoption: `convex/functions/update.ts`.
- Project and organization reporting: the Storage settings routes.

Deferred work includes authenticated clean-domain delivery for private files,
cache-tag purging on access-policy changes, staff-only inspection of hidden
user files, virus/malware scanning, provider adapters and sync state,
paid-tier assignment, and organization-global usage rollups. These are designed
seams, not implicit behavior in the first pass.

Required verification includes classification, quota boundaries, staff/user
attribution, cross-project authorization, hidden-user-file isolation, search
scope, cursor stability, double completion, replacement deltas, rejected and
abandoned cleanup, referenced deletion, codegen, TypeScript, lint, tests, and a
Convex development push.
