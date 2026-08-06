# Moderator Access Rollout

This change must ship as a widen–migrate–narrow rollout. Do not combine the
schema narrowing with the compatibility deployment.

## Before Deploy 1

Record production counts for:

- organization members with `role = "editor"`
- pending invitations with `role = "editor"`
- users and profiles with `role = "system:editor"`
- project members with `role = "org:admin"` or `"org:editor"`
- direct project members with `role = "member"`

The first and third counts are the release-note impact: existing editors lose
project management until an owner/admin explicitly assigns projects, and
system editors become ordinary users.

Release-note copy:

> Organization Editors are now Moderators. Existing Editors have been renamed
> but start with no project access; organization owners/admins must explicitly
> assign their projects. The retired global System Editor role now behaves as
> an ordinary user.

## Deploy 1

Deploy the compatibility schema and behavior in this branch:

- both moderator-access tables and indexes
- optional legacy `projectMember.role`
- legacy Better Auth `editor` registration
- explicit assignment authorization
- granular project capabilities
- wrapped invitation acceptance
- no organization-to-project member cascade

Run codegen before migrations:

```sh
pnpm run codegen
pnpm exec kitcn migrate status --prod
```

The immutable migration order is:

1. `20260729_215959_rename_org_editor_to_moderator`
2. `20260729_220000_rename_editor_invitations`
3. `20260729_220001_downgrade_system_editor_users`
4. `20260729_220002_downgrade_system_editor_profiles`
5. `20260729_220003_simplify_project_members`

Use the production migration runner's dry-run mode before applying each entry
when that mode is available in the deployed kitcn version, and record affected
counts in the release ticket. Apply in bounded batches (the deploy configuration
defaults to 256), wait for completion, and never edit an applied migration.

```sh
pnpm exec kitcn migrate up --prod
pnpm exec kitcn migrate status --prod
```

## Verification gate

Do not proceed to Deploy 2 until production inspection confirms:

- zero organization members or invitations with `editor`
- zero users or profiles with `system:editor`
- zero project-member rows with `org:admin` or `org:editor`
- preserved direct-member rows have no `role`
- zero moderator assignments were created by the migrations
- `user.role` and `profile.role` agree for every downgraded system editor

Also exercise one owner/admin, assigned moderator, unassigned moderator, and
direct private-project member against public, private, and archived projects.

## Deploy 2

Only after the verification gate:

- remove the legacy Better Auth `editor` role
- narrow profile roles to `system:admin | user`
- remove `projectMember.role` and its legacy role indexes
- remove invitation acceptance compatibility normalization
- regenerate Convex and cRPC types
- run the full validation suite and production build

Deploy 2 should contain no data migration edits. Any correction requires a new
timestamped migration.
