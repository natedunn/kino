# Roles & Permissions

This is the canonical reference for how authorization works in Kino. There is
**one enforcement system**: every org/project-scoped read and write resolves a
permission through the helpers in `convex/lib/kino.ts`. The frontend only ever
mirrors server-computed permissions — it never decides access on its own.

## The three scopes

| Scope | Stored in | Values | Source of truth | Enforced by |
| --- | --- | --- | --- | --- |
| **System** | `user.role` → mirrored to `profile.role` | `system:admin`, `system:editor`, `user` | `user.role` (better-auth) | `verifyOrgAccess` / `verifyProjectAccess` (read `profile.role`) |
| **Organization** | `member.role` (better-auth organization plugin) | `owner`, `admin`, `editor`, `member` | `member.role` | `verifyOrgAccess` |
| **Project** | `projectMember.role` (derived from org role) | `org:admin`, `org:editor`, `member` | derived — see below | `verifyProjectAccess` |

### System role (controlled denormalization)
`user.role` is the source of truth. `profile.role` is a **derived copy** kept in
sync by the `user.change` trigger (`convex/functions/auth.ts`) and self-healed on
session bootstrap (`ensureUserBootstrap` / `reconcileSystemRole` in
`convex/lib/kino.ts`). All authorization reads `profile.role`. Never write
`profile.role` outside `sanitizeSystemRole` — that is the single sanitizer.

- `system:admin` — full access everywhere; powers the `/admin` dashboard.
- `system:editor` — may edit + view any org/project, but not create or delete.
- `user` — no elevated access; permissions come from org/project membership.

System admins are seeded from `SUPER_ADMIN_EMAIL` at sign-up. There is no
better-auth admin plugin — it was removed; the `system:admin` role is the app's
own and is enforced by the helpers above.

### Organization role
Org membership is managed at `/@<org>/settings/members` (see
`convex/functions/orgMember.ts`). Roles are registered as real better-auth
access-control roles in `convex/shared/auth-roles.ts` so they are assignable
(including via invitations). `verifyOrgAccess` grants:

| Role | view | edit | create | delete/manage members |
| --- | --- | --- | --- | --- |
| owner / admin | ✅ | ✅ | ✅ | ✅ |
| editor | ✅ | ✅ | ❌ | ❌ |
| member | ✅ | ❌ | ❌ | ❌ |
| (non-member) | public orgs only | ❌ | ❌ | ❌ |

### Project role (derived from org role)
Project membership is **purely derived** from org membership via
`ORG_ROLE_TO_PROJECT_ROLE` (`convex/functions/schema.ts`) and kept in sync by
schema triggers. There is no standalone per-project membership.

| Org role | → Project role |
| --- | --- |
| owner / admin | `org:admin` |
| editor | `org:editor` |
| member | `member` |

`verifyProjectAccess` is visibility-aware (`public` / `private` / `archived`):

| Project role | public | private | archived | delete |
| --- | --- | --- | --- | --- |
| org:admin | view+edit | view+edit | view | ✅ (only org:admin) |
| org:editor | view+edit | view+edit | view | ❌ |
| member | view | view | ❌ | ❌ |
| (non-member) | view | ❌ | ❌ | ❌ |

## The rule for new code

**Every Convex query/mutation/action that reads or writes org-, project-,
feedback-, or update-scoped data MUST gate through one of:**

- `verifyOrgAccess(ctx, { id|slug, userId })`
- `verifyProjectAccess(ctx, { id|slug, userId })`
- `getProjectViewAccess(ctx, { id|slug, userId })` — non-throwing, fails closed; use for read paths
- For feedback/update children, resolve the parent project first, then gate.

Builders (`convex/lib/crpc.ts`): `publicQuery`/`publicMutation` (no auth),
`optionalAuthQuery`/`optionalAuthMutation` (auth optional), `authQuery`/
`authMutation`/`authAction` (auth required, NO role check — you must still call a
`verify*Access` helper), `privateQuery`/`privateMutation`/`privateAction`
(internal only).

Do **not** introduce a second source of truth (e.g. reading `user.role` for
authz, or re-deriving permissions client-side). Keep all `can*` decisions in the
`verify*Access` helpers.

### Review checklist
- [ ] New scoped endpoint calls a `verify*Access` helper (or is `private*`).
- [ ] Read paths fail closed (return empty/null) when `canView` is false.
- [ ] Client-supplied ids are validated to belong to the authorized scope.
- [ ] Writes that require management use `canDelete`/`canEdit` as appropriate.
- [ ] No new `publicQuery`/`publicMutation` exposing scoped data.

## Known gaps / follow-ups
- **Invitation emails**: `orgMember.inviteMember` creates the invitation record
  but there is no email delivery configured yet — wiring `sendInvitationEmail`
  (e.g. Resend / Cloudflare Email) is a follow-up. Invites can be accepted via
  link in the meantime.
- **Project-membership sync**: org → project sync runs via schema triggers and
  is idempotent for the common paths. A reconcile-on-bootstrap safety net (to
  self-heal the rare "profile missing at sync time" race) is a future
  enhancement; current live data is consistent.
- **Dead better-auth columns**: `user.banned/banReason/banExpires` and
  `session.impersonatedBy` remain in the schema (inert) after the admin-plugin
  removal. Dropping them needs a widen-migrate-narrow migration (existing rows
  carry `banned: false`).
