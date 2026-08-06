# Roles & Permissions

This is the canonical authorization reference for Kino. Server-computed
permissions are the enforcement boundary; the frontend only mirrors them.

## Scopes and sources of truth

| Scope                     | Stored in                               | Values                                            | Purpose                              |
| ------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| System                    | `user.role`, mirrored to `profile.role` | `system:admin`, `user`                            | Global administration                |
| Organization              | Better Auth `member.role`               | `owner`, `admin`, `moderator`, framework `member` | Organization identity and management |
| Moderator assignment      | `projectModeratorAccess`                | one active row per moderator/project              | Explicit project management          |
| Direct project membership | `projectMember`                         | no role field                                     | Participation in a private project   |

Kino is mostly public. Anyone can view and participate in public projects under
the existing public-project rules. Organization membership does not by itself
grant authority over a project.

### System roles

`user.role` is authoritative. `profile.role` is a controlled derived copy,
maintained by the user trigger and reconciled during session bootstrap.
Authorization reads the sanitized profile role.

- `system:admin` has every organization and project capability.
- `user` has no global privileges.

The removed `system:editor` value is treated as `user` during the compatibility
deployment and migrated in both tables before the schema is narrowed.

### Organization roles

- `owner` and `admin` manage organization settings, members, integrations, and
  every project in the organization.
- `moderator` can view the organization as a team identity but cannot access
  organization settings. Project authority requires an explicit active
  assignment.
- Better Auth's framework-compatible `member` role carries no Kino management
  authority and is not offered by Kino's invitation or role-management UI.

`findMyEditableOrgs` returns owner/admin memberships only. Moderators therefore
do not appear in the organization-settings selector, and direct settings
navigation is rejected.

### Project access

`verifyProjectAccess` returns:

```ts
{
	canView: boolean;
	canManageContent: boolean;
	canEditSettings: boolean;
	canManageAccess: boolean;
	canManageIntegrations: boolean;
	canDelete: boolean;
}
```

Capabilities resolve in this order:

1. System admin: all capabilities.
2. Organization owner/admin: all capabilities on every organization project.
3. Current organization moderator with a matching
   `projectModeratorAccess` row: view, content management, and ordinary project
   settings.
4. Direct `projectMember`: view and normal participation in a private project.
5. Signed-in or anonymous visitor: existing public-project behavior.
6. Everyone else: fail closed.

Every moderator-assignment read also verifies that the referenced member still
belongs to the project organization and still has role `moderator`. A stale row
never grants access.

| Actor                 | Org settings |           Project content |  General settings | Members | Integrations | Project deletion |
| --------------------- | -----------: | ------------------------: | ----------------: | ------: | -----------: | ---------------: |
| System admin          |          Yes |                       Yes |               Yes |     Yes |          Yes |              Yes |
| Org owner/admin       |          Yes |              All projects |      All projects |     Yes |          Yes |              Yes |
| Assigned moderator    |           No |         Assigned projects | Assigned projects |      No |           No |               No |
| Unassigned moderator  |           No | Public participation only |                No |      No |           No |               No |
| Direct project member |           No |      Normal participation |                No |      No |           No |               No |
| Ordinary user         |           No |      Public participation |                No |      No |           No |               No |

Assigned moderators may view assigned private and archived projects. Archived
projects remain read-only through `assertProjectWritable`. Only owners/admins
may archive or unarchive. Moderators can change general metadata and visibility,
manage feedback, comments, boards, drafts, updates, status, priority, targets,
answers, and link feedback to a repository already configured for the project.
Repository installation/configuration remains owner/admin-only.

`projectMember` exclusively represents direct private-project participation.
It must never be used to represent organization roles or moderator assignments.

## Invitations and role transitions

The `owner` role is frozen: it cannot be granted, revoked, or removed through
invitations or member management — not even by the owner themselves. The
role-input schemas exclude `owner` and `updateMemberRole`/`removeMember` reject
any owner-targeting request server-side; the members UI renders the owner row's
controls disabled to match. Changing ownership will be a dedicated transfer
flow later.

Moderator invitations require a non-empty `projectIds` array — a moderator with
zero projects can manage nothing, so one can never be created (enforced in
`inviteMember`/`updateMemberRole` and mirrored by the UI). An existing
moderator can still be stripped to zero assignments through
`setModeratorProjectAccess`. Selections are stored in
`pendingModeratorProjectAccess` until the authenticated recipient accepts
through `orgMember.acceptInvitation`. Acceptance calls Better Auth first, then
activates assignments idempotently and removes the pending rows.

Changing into `moderator` likewise requires at least one selected project.
Changing out of the role, removing a member, or leaving the organization deletes
all assignments. Assignments are not dormant and new projects do not inherit
them.

## Rules for new code

Every organization/project-scoped endpoint must use one of:

- `verifyOrgAccess(ctx, { id | slug, userId })`
- `verifyProjectAccess(ctx, { id | slug, userId })`
- `getProjectViewAccess(ctx, { id | slug, userId })` for non-throwing reads

Use the narrowest project capability:

- content, comments, feedback, boards, drafts, updates:
  `canManageContent`
- name, description, slug, links, logo, visibility:
  `canEditSettings`
- direct members and moderator assignments: `canManageAccess`
- repository installation/configuration: `canManageIntegrations`
- project deletion and archive/unarchive: owner/admin capability (`canDelete`)

For feedback/update children, resolve and authorize the parent project. Validate
all client-supplied member, organization, and project IDs as belonging to the
same scope. Hidden navigation is never a substitute for the server check.

### Review checklist

- [ ] Scoped endpoints call the appropriate access helper.
- [ ] Reads fail closed when `canView` is false.
- [ ] Writes check the narrowest capability.
- [ ] Archived-project writes call `assertProjectWritable`.
- [ ] Cross-organization IDs are rejected.
- [ ] Moderator grants revalidate current organization and role.
- [ ] Direct member rows contain no organization-derived authority.

## Compatibility deployment

During Deploy 1 only, schemas and Better Auth registration accept legacy
`editor`, `system:editor`, and legacy project-member role values so existing
rows and invitations remain readable while migrations run. Authorization does
not honor those values. The timestamped migrations rename organization members
and invitations, downgrade both system-role copies, delete org-derived project
rows, and unset the direct-member role. Deploy 2 removes all compatibility
shapes after verification.
