# Native file cleanup proof

September 21, 2026. Isolated schema and owner-only authorization. No remote R2
bucket or deployment was modified. R2 tests use Miniflare/workerd, not Cloudflare's
hosted service. This proves the cleanup protocol, not the entire Kino upload stack.

## Contract implemented

- Only trusted registration chooses bytes and generates an immutable object key
  from tenant and asset IDs. Reusing a filename produces a different key.
- Removing a referenced asset is restricted. Otherwise deletion atomically hides
  the asset, writes durable cleanup work and schedules an action. New references
  are refused. Repeated removal returns the same job.
- The action claims a 30-second lease with a monotonic attempt number. Its recovery
  wakeup is scheduled in the same transaction. Duplicate deliveries cannot claim
  an unexpired lease. Expired work can be retried even if an action crashed.
- The external transport receives only stored immutable object keys and the stored
  public-ID cache tag. Successful deletion and purge are followed by an
  acknowledgement mutation. Already absent objects are safe to delete again.
- Acknowledgement releases either used bytes/file count or reserved upload bytes
  exactly once, atomically with marking the asset and job deleted/done. Quota stays
  charged while work is incomplete. Stale attempt acknowledgements are ignored.
- Three failed attempts leave a durable failed job. The owner can resume another
  three attempts without resetting the attempt number. Another tenant cannot
  remove or resume work. Failure codes contain no storage credentials.

`PROOF_STORAGE_DELETE_URL` and `PROOF_STORAGE_DELETE_TOKEN` describe the action's
transport boundary. Tests inject the adapter; no public cleanup endpoint is
implemented or deployed. Product wiring must authenticate that endpoint (or use a
server SDK), constrain its bucket/prefix, and never expose its credentials.

## Evidence

Nine Convex tests exercise authorization, references, immediate hiding, duplicate
requests/acknowledgements, lease expiry, stale acknowledgements, retry caps and
automatic scheduled recovery, owner resume, quota rollback, replacement uploads,
reserved-byte accounting, and both sides of the upload/delete race.

Three runtime tests use local R2:

1. Delete succeeds, then database acknowledgement deliberately fails. Retrying
   deletes the absent object safely and decrements quota once. A replacement with
   the same filename and another tenant's object and quota survive.
2. Compile and run Kino's actual files Worker, warm a public URL, delete its object,
   and request again. The warmed URL returns 200 with the cached body; a cold URL
   and HEAD return 404. Origin deletion does not prove public access revocation.
3. A revoked upload can still land on its unique staging key. Cleanup waits until
   the grant expiration plus a settlement window, then deletes staging, final,
   public-copy and thumbnail keys. A failed cache purge leaves the job retryable;
   retrying absent R2 keys is safe.

Every cached filename/query-string variant for an original or thumbnail now stores
the same `kino-file-<publicId>` cache tag. The cleanup adapter deletes immutable
keys first and then sends one global tag purge. The Convex job is acknowledged only
after both operations succeed. This preserves fast cache hits: the Worker does not
add an R2 metadata check to every request. Hosted purge propagation still needs the
disposable preview rehearsal described below.

The runtime test also found that R2 range metadata could cause a full GET to return
206. The small fix in `workers/files/src/index.ts` requires a request Range header
before returning partial content. A Worker regression test covers full GET with
range metadata, and the existing range test still passes. This fix is not deployed.

Run from `experiments/convex-auth-v2`:

```sh
node node_modules/vitest/vitest.mjs run tests/storage-cleanup.test.ts tests/storage-r2.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Miniflare is pinned to 4.20260521.0 with compatibility date 2026-05-28, supported by
its bundled runtime. Tests do not claim current hosted edge behavior was rehearsed.

## Product integration gates

- Expand one-object fixtures to original objects, public copies and thumbnails,
  and both user/org buckets. Keep each immutable key's acknowledgement independent.
- The relationship experiment now integrates bounded project purges with this
  lifecycle and proves wait/failure/resume behavior locally. Port that design to
  Kino's product tables without ORM-cascading cleanup records while actions are
  pending, and preserve every file reference/restrict policy.
- Reconcile Kino's per-project/per-org and category/origin/uploader counters; this
  model proves scalar used/reserved/count semantics only. Preserve upload limits.
- Product upload intents need unique staging keys, capped expirations, and a
  settlement window derived from the maximum permitted transfer. Deletion revokes
  completion immediately but waits through that window before final cleanup. For
  multipart uploads, abort/reconciliation must be included. The proof does not
  issue real presigned URLs, so hosted request-duration behavior remains a gate.
- Public URL removal uses one cache tag across originals, thumbnails, filenames and
  query variants, followed by Cloudflare's global tag purge. Validate that the
  production zone and Cache API attach/purge tags as documented. Browser copies
  already delivered cannot be recalled.
- Add operational failure alerts, inspection/resume UI and retention. Owner-only
  checks here must become the existing app permission policy. Rehearse against
  disposable hosted objects before declaring deployed storage cleanup validated.

Cloudflare's [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
documents key-based deletion; it does not take a version/ETag precondition. Therefore
immutable keys are a requirement, not a HEAD-then-delete version check (which would
race). Its [consistency documentation](https://developers.cloudflare.com/r2/reference/consistency/)
distinguishes strongly consistent storage operations from caching effects.
