# Reactions ("emotes") — storage, counts, and the kitcn aggregate

## What can be reacted to

Reactions are modeled as **emotes** (fixed emoji vocab in `EMOTE_CONTENTS`, `convex/functions/schema.ts`).
There are three per-entity tables — not a single polymorphic table:

| Table | Reacts to |
|---|---|
| `feedbackCommentEmote` | feedback comments |
| `updateEmote` | updates (posts/changelog) |
| `updateCommentEmote` | update comments |

(Feedback *items* use a separate `feedbackUpvote` table with its own hand-rolled counter.)

Each table has a single `toggle` mutation that inserts if absent / deletes if present, keyed on a
`..._authorProfileId_content` index. Child emotes are removed declaratively via FK `onDelete: 'cascade'`.

## How counts work

Two strategies coexist, on purpose:

1. **Multi-emoji breakdown** (grouped by emoji, with which profiles reacted) → plain
   `ctx.db.query(...).collect()` + tally in JS. This is core Convex over a small, bounded per-item set
   (`feedbackComment.ts`, `updateComment.ts`, `update.lib.ts`, `update.ts`).

2. **Single hot count** (the update "heart" like count) → `ctx.orm.query.updateEmote.count({ where })`,
   backed by kitcn's `aggregateIndex`.

## What kitcn's `aggregateIndex().count()` actually is

It is a **homegrown/vendored aggregate engine, NOT the official `@convex-dev/aggregate` component**
(our `convex.config.ts` only mounts `r2`). kitcn injects `aggregate_bucket` / `aggregate_rank_*` /
`aggregate_state` tables into our data model and maintains them via an implicit ORM change-trigger.

- **Filtered `.count({ where })`** reads a single `aggregate_bucket` row per key-tuple. The count is
  updated transactionally in the **same mutation** as the source insert/delete — this matches Convex's
  own guidance (`_generated/ai/guidelines.md`: keep the aggregate in sync in the same mutation, never
  from a separate function, so it can't drift).
- **Unfiltered `.count()`** uses Convex's **native count syscall** — exact, efficient, fetches no rows
  (see `admin.ts`).

## Gotchas to respect

- **Drift**: the count stays correct only because every write goes through `ctx.orm` (so the trigger
  fires). **Never write `updateEmote` / `updateComment` via raw `ctx.db`** — that bypasses the trigger
  and silently drifts the bucket. (Reads via `ctx.db` are fine; they don't touch the count.)
- **Backfill required after adding an index**: a filtered `.count()` throws `COUNT_INDEX_BUILDING`
  until the index is backfilled to `READY`. Adding a NEW `aggregateIndex` (or changing its key)
  requires running the generated `aggregateBackfill` mutation (`internal.generated.server.aggregateBackfill`,
  which schedules `aggregateBackfillChunk` batches). `convex/functions/aggregate-drift.test.ts` shows
  how to drive this in tests (kick off backfill + drain the scheduler).
- **Hot-key contention**: the count bucket is a **single unsharded row per key**, so concurrent toggles
  on the same key do a read-modify-write of one row → OCC retries under bursts. Low risk at normal
  reaction volume (and the client debounces toggles ~300ms); the failure scenario is a viral update
  hearted by many people simultaneously.

## Migration surface (if we ever leave kitcn's aggregate)

Small and contained. Filtered `.count()` call sites tied to the aggregate buckets are just **four, all
in `convex/functions/update.ts`** (the `heart` count in `getDetailCritical`, `getDetailInteractive`,
the list query, and the comment count). Escape ramps:

1. Mount the official `@convex-dev/aggregate` component (adds b-tree + `namespace` sharding to fix
   hot-key contention).
2. Hand-rolled denormalized counter — precedent already exists in `feedbackUpvote.ts`.
3. Plain `collect().length` for low-volume surfaces.

The two aggregate-indexed tables are annotated in `schema.ts` (`updateComment`, `updateEmote`).
