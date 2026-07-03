// A board delete cascades board → feedback → each feedback's comments, events,
// upvotes, emotes, and GitHub connections. Doing that for a large board in a
// single `ctx.orm.delete` could exceed Convex's per-mutation document limit, so
// non-empty boards are soft-hidden and their feedback purged in bounded batches
// by `purgeBoard` (each feedback delete hard-cascades to its own children).
export const BOARD_FEEDBACK_PURGE_BATCH_SIZE = 50
