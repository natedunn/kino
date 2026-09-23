# Native relationship and deletion proof

September 21, 2026. Isolated native Convex experiment; not a migration of the
running Kino application. Authorization here is owner-only. Product integration
must reuse the separate organization permission matrix.

## Inventory and replacement approach

[CASCADE-MAP.md](CASCADE-MAP.md) inventories 70 declared relationships across 35
product tables, including delete actions and leading indexes. Regenerate with
`node scripts/cascade-inventory.mjs` from the parent experiment. The accompanying
JSON is machine-readable. Installed Kitcn 0.31.1 defaults omitted delete actions
to `no action`, which rejects deletion with dependents. Do not silently replace
these relationships with cascades. Scalar/string references, triggers and external
resources require additional review beyond the schema inventory.

The existing project purge batches parents and invokes ORM cascades. That does
not bound the descendants of each parent. This experiment bounds actual child
writes to 25 per job step, with indexed scope fields derived from validated
parents. Row bounds do not replace Convex byte/time limits or production sizing.

## Implemented behavior

- Project creation transactionally creates three default boards.
- Feedback creation adds its initial comment and search content; editing that
  comment updates search content. Vote changes are idempotent and update counts.
- Project, board, feedback and non-initial-comment deletion support resumable,
  versioned jobs. Parents disappear last. Duplicate/stale steps do no work.
- Board/feedback cleanup includes comments, reactions, votes, events and local
  GitHub links. Board deletion preserves repository connections and sibling boards.
- Comment cleanup deletes reactions and clears reply/answer pointers while keeping
  replies. Initial comments cannot be independently deleted. Direct small comment
  deletion is atomic and refuses oversized work without partial changes.
- A deletion flag immediately hides the affected scope and rejects descendant
  writes. Queries hide deleting comments/boards and unavailable answer/reply targets.
- Direct folder deletion restricts nonempty folders. Whole-project deletion
  removes the fenced folder tree. There is no restore after deletion begins.
- Whole-project deletion first creates at most 25 file-cleanup jobs, waits for
  every R2 deletion and cache purge to be acknowledged, verifies storage usage is
  zero, and only then removes file metadata and continues the database cascade.
  Failed cleanup leaves the project fenced and owner-resumable.

This is explicit domain code, not a general-purpose ORM replacement. Every child
write validates parent scope; merely using a Convex ID does not enforce a foreign
key. Jobs persist their progress and schedule the next step transactionally.
Explicit authorized resume repairs interrupted scheduling; automated recovery,
monitoring and job retention remain integration work.

## Evidence

20 targeted tests cover authorization/foreign-parent denial, cascade/set-null/
restrict behavior, a 555-row board cascade, sibling and organization isolation,
interrupted scheduling and resume, transaction rollback, duplicate/out-of-order
steps, overlapping ancestor/descendant deletion, defaults, search, votes, and
project deletion with 31 assets across multiple storage-enqueue batches. Storage
tests prove that persistent transport failure preserves the project, metadata and
quota; owner resume completes it; forged cleanup completion cannot bypass the
zero-accounting invariant; pending uploads wait through their settlement window
and release reserved quota; and another tenant survives.

The real local backend test on port 4430 raced 30 independent HTTP writes against
board deletion: 28 committed and were removed, two were rejected. A subsequent
write was rejected, the board was hidden, all dependent sets emptied, and sibling
feedback survived. See [results-race.json](results-race.json). The exact race split
is nondeterministic; deterministic tests exercise both orderings. This is local
scheduler evidence, not a deployed outage/recovery or throughput benchmark.

The composite local-backend run exercised Convex scheduling through a real HTTP
cleanup adapter backed by local R2: four assets produced 12 object deletions and
four cache-tag purges, then the project was removed. Another tenant's project,
objects and quota survived. See
[results-project-storage-live.json](results-project-storage-live.json). This is
local infrastructure evidence; no hosted bucket or application deployment changed.

From `experiments/convex-auth-v2`:

```sh
node node_modules/vitest/vitest.mjs run tests/relationship-lifecycle.test.ts tests/feedback-cascade.test.ts tests/project-storage-cascade.test.ts
node node_modules/typescript/bin/tsc --noEmit
# Requires this isolated relationship backend running on 4430/4431:
node scripts/cascade-race.mjs
node scripts/project-storage-live.mjs
```

## Remaining migration gates

| Area                             | Work still required                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Updates/comments/emotes          | Apply and test their full product cascade graph                                                   |
| Profile/account deletion         | Preserve author restrictions and nullable assignee/publisher references                           |
| Org/project policies             | Integrate role matrix, product limits and community author permissions                            |
| Files/folders/assets             | Port the proven outbox into product tables; preserve asset-folder set-null and reference policies |
| Themes/storage usage             | Port every category/origin/uploader and organization counter, beyond the scalar proof             |
| GitHub installations/connections | Full local metadata lifecycle and Relay integration; no remote repository/issue deletion implied  |
| Denormalized fields              | Preserve slug/visibility propagation and audit all trigger side effects                           |
| Operations                       | Automated recovery, monitoring, retention and deployed failure rehearsal                          |

The external cleanup and cache-invalidation contract is detailed in the sibling
`storage/README.md`. Remaining work is product-table integration, complete counter
dimensions, operational UI/alerts and a disposable hosted rehearsal.
