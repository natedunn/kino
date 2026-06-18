# Roles & Permissions

This is the canonical reference for how authorization works in Kino. There is
**one enforcement system**: every org/project-scoped read and write resolves a
permission through the helpers in `convex/lib/kino.ts`. The frontend only ever
mirrors server-computed permissions — it never decides access on its own.

## The three scopes

| Scope            | Stored in                                       | Values                                                          | Source of truth           | Enforced by                                                     |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| **System**       | `user.role` → mirrored to `profile.role`        | `system:admin`, `system:editor`, `user`                         | `user.role` (better-auth) | `verifyOrgAccess` / `verifyProjectAccess` (read `profile.role`) |
| **Organization** | `member.role` (better-auth organization plugin) | `owner`, `admin`, `editor`                                      | `member.role`             | `verifyOrgAccess`                                               |
| **Project**      | `projectMember.role`                            | `org:admin`, `org:editor` (derived from org), `member` (direct) | hybrid — see below        | `verifyProjectAccess`                                           |

Kino is a mostly-public service: **anyone with an account has a public profile
and can view + comment + upvote + submit feedback on any _public_ project, in any
org, with no membership.** Roles below only restrict _management_ and _access to
private projects_.

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

An org's roles are the **team that runs it**. There is **no plain org "member"**
— public users don't "join" orgs. Roles are managed at `/@<org>/settings/members`
(`convex/functions/orgMember.ts`) and registered as real better-auth
access-control roles in `convex/shared/auth-roles.ts` so they're assignable
(including via invitations). Org roles **cascade to every project in the org**.
`verifyOrgAccess` grants:

| Role          | view             | edit | create | delete/manage members |
| ------------- | ---------------- | ---- | ------ | --------------------- |
| owner / admin | ✅               | ✅   | ✅     | ✅                    |
| editor        | ✅               | ✅   | ❌     | ❌                    |
| (non-member)  | public orgs only | ❌   | ❌     | ❌                    |

(`owner` is the creator and the only role that can grant/revoke `owner`.)

### Project role (hybrid: derived management + direct private membership)

A project's roles come from **two sources**:

1. **Management — derived from org role** via `ORG_ROLE_TO_PROJECT_ROLE`
   (`convex/functions/schema.ts`), kept in sync by schema triggers:

   | Org role      | → Project role |
   | ------------- | -------------- |
   | owner / admin | `org:admin`    |
   | editor        | `org:editor`   |

2. **Private-project access — direct, per-project** (`projectMember.role =
"member"`, managed at `/@<org>/<project>/settings/members` via
   `convex/functions/projectMember.ts`). A `member` row gives an individual user
   normal access to a **private** project that's otherwise hidden. On a **public**
   project the row is inert (everyone can already view) and is intentionally
   **kept** so access is restored if the project goes private again.

`verifyProjectAccess` is visibility-aware (`public` / `private` / `archived`):

| Project role            | public             | private   | archived | delete              |
| ----------------------- | ------------------ | --------- | -------- | ------------------- |
| org:admin               | view+edit          | view+edit | view     | ✅ (only org:admin) |
| org:editor              | view+edit          | view+edit | view     | ❌                  |
| member (direct)         | view               | view      | ❌       | ❌                  |
| (non-member, signed in) | view + participate | ❌        | ❌       | ❌                  |
| (anonymous)             | view               | ❌        | ❌       | ❌                  |

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
  but there is no email delivery configured yet — wiring better-auth's
  `sendInvitationEmail` hook to a provider (e.g. Resend / Cloudflare Email) is a
  follow-up. (Project members are added by looking up existing accounts, so they
  don't depend on email.)
- **Org-level ban of public users**: not built. better-auth has no org-level ban
  (its `banned` was a _global_ admin-plugin ban, now removed; the org plugin has
  no ban concept). A per-org block needs our own table (e.g. `orgBlock { orgId,
profileId }`) checked in the feedback/comment/upvote write paths — intended
  behavior: a blocked user can still read public projects but cannot write to any
  project owned by that org.
- **Impersonation**: not built. It lives in better-auth's `admin` plugin
  (`impersonateUser` / `stopImpersonating` / `session.impersonatedBy`), which was
  removed. Re-add a configured `admin({ adminRoles: ["system:admin"] })` if you
  want "log in as user" for support.
- **Project-membership sync**: org → project sync runs via schema triggers and
  is idempotent for the common paths. A reconcile-on-bootstrap safety net (to
  self-heal the rare "profile missing at sync time" race) is a future
  enhancement; current live data is consistent.
- **Dead better-auth columns**: `user.banned/banReason/banExpires` and
  `session.impersonatedBy` remain in the schema (inert) after the admin-plugin
  removal. Dropping them needs a widen-migrate-narrow migration (existing rows
  carry `banned: false`).
