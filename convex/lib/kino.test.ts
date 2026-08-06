import { describe, expect, it } from 'vitest';

import {
	assertProjectWritable,
	ensureUniqueOrgSlug,
	getProjectViewAccess,
	pickPersonalOrganizationId,
	reconcileSystemRole,
	sanitizeSystemRole,
	verifyOrgAccess,
	verifyProjectAccess,
} from './kino';

function makeAccessCtx(opts: {
	organizationMember?: { id: string; role: string; userId?: string } | null;
	moderatorAssigned?: boolean;
	project?: { id: string; orgSlug?: string; slug: string; visibility: string } | null;
	profile?: { id: string; role: string; userId: string } | null;
	projectMember?: { id: string; role?: string } | null;
}) {
	const organization = { id: 'org_1', slug: opts.project?.orgSlug ?? 'acme' };
	return {
		orm: {
			query: {
				member: {
					findMany: async () =>
						opts.organizationMember
							? [{ userId: 'user_1', ...opts.organizationMember, organizationId: 'org_1' }]
							: [],
				},
				organization: {
					findMany: async () => (opts.project ? [organization] : []),
				},
				project: {
					findMany: async () =>
						opts.project ? [{ orgSlug: organization.slug, ...opts.project }] : [],
				},
				profile: {
					findMany: async () => (opts.profile ? [opts.profile] : []),
				},
				projectMember: {
					findMany: async () =>
						opts.projectMember ? [{ ...opts.projectMember, projectId: opts.project?.id }] : [],
				},
				projectModeratorAccess: {
					findFirst: async () =>
						opts.moderatorAssigned
							? {
									memberId: opts.organizationMember?.id,
									organizationId: organization.id,
									projectId: opts.project?.id,
								}
							: null,
				},
			},
		},
	} as any;
}

describe('pickPersonalOrganizationId', () => {
	it('prefers an admin membership whose slug matches the username', () => {
		expect(
			pickPersonalOrganizationId({
				memberships: [
					{ organizationId: 'org_team', role: 'admin', slug: 'acme' },
					{ organizationId: 'org_personal', role: 'admin', slug: 'nate' },
				],
				profileUsername: 'nate',
			})
		).toBe('org_personal');
	});

	it('falls back to the only admin-owned organization when there is no slug match', () => {
		expect(
			pickPersonalOrganizationId({
				memberships: [
					{ organizationId: 'org_personal', role: 'admin', slug: 'old-handle' },
					{ organizationId: 'org_team', role: 'member', slug: 'acme' },
				],
				profileUsername: 'nate',
			})
		).toBe('org_personal');
	});

	it('does not infer a personal workspace from non-admin memberships', () => {
		expect(
			pickPersonalOrganizationId({
				memberships: [{ organizationId: 'org_team', role: 'member', slug: 'acme' }],
				profileUsername: 'nate',
			})
		).toBeNull();
	});
});

describe('ensureUniqueOrgSlug', () => {
	it('avoids reserved handles when deriving an org slug from a name', async () => {
		const ctx = {
			orm: {
				query: {
					organization: {
						findFirst: async () => null,
					},
				},
			},
		};

		const slug = await ensureUniqueOrgSlug(ctx as any, 'Settings');

		expect(slug).toMatch(/^org-[a-f0-9]{8}$/);
	});
});

describe('verifyProjectAccess', () => {
	it('grants an assigned moderator content and settings, but not access or integrations', async () => {
		const ctx = makeAccessCtx({
			moderatorAssigned: true,
			organizationMember: { id: 'member_1', role: 'moderator' },
			project: { id: 'project_1', slug: 'feedback', visibility: 'private' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'project_1',
			userId: 'user_1',
		});

		expect(access.permissions).toEqual({
			canDelete: false,
			canEditSettings: true,
			canManageAccess: false,
			canManageContent: true,
			canManageIntegrations: false,
			canView: true,
		});
	});

	it('does not let an unassigned moderator manage a public project', async () => {
		const ctx = makeAccessCtx({
			moderatorAssigned: false,
			organizationMember: { id: 'member_1', role: 'moderator' },
			project: { id: 'project_1', slug: 'feedback', visibility: 'public' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'project_1',
			userId: 'user_1',
		});

		expect(access.permissions.canView).toBe(true);
		expect(access.permissions.canManageContent).toBe(false);
		expect(access.permissions.canEditSettings).toBe(false);
	});

	it('hides an unassigned private project from a moderator', async () => {
		const ctx = makeAccessCtx({
			organizationMember: { id: 'member_1', role: 'moderator' },
			project: { id: 'project_1', slug: 'feedback', visibility: 'private' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'project_1',
			userId: 'user_1',
		});
		expect(access.project).toBeNull();
		expect(access.permissions.canView).toBe(false);
	});

	it('ignores a stale assignment when the organization member is no longer a moderator', async () => {
		const ctx = makeAccessCtx({
			moderatorAssigned: true,
			organizationMember: { id: 'member_1', role: 'member' },
			project: { id: 'project_1', slug: 'feedback', visibility: 'private' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'project_1',
			userId: 'user_1',
		});
		expect(access.project).toBeNull();
		expect(access.permissions.canView).toBe(false);
		expect(access.permissions.canManageContent).toBe(false);
	});

	it('ignores legacy organization-derived project-member roles', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'project_1', slug: 'feedback', visibility: 'private' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
			projectMember: { id: 'legacy_1', role: 'org:admin' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'project_1',
			userId: 'user_1',
		});
		expect(access.project).toBeNull();
		expect(access.permissions.canView).toBe(false);
	});

	it('treats a legacy system editor as an ordinary user', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'project_1', slug: 'feedback', visibility: 'private' },
			profile: {
				id: 'profile_1',
				role: 'system:editor',
				userId: 'user_1',
			},
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'project_1',
			userId: 'user_1',
		});
		expect(access.project).toBeNull();
		expect(access.permissions.canView).toBe(false);
	});

	it('lets anyone view a public project but not manage it', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'public' },
		});
		const access = await verifyProjectAccess(ctx, { id: 'p1' });
		expect(access.permissions.canView).toBe(true);
		expect(access.permissions.canManageContent).toBe(false);
		expect(access.permissions.canEditSettings).toBe(false);
		expect(access.permissions.canDelete).toBe(false);
	});

	it('hides a private project from non-members', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'private' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
			projectMember: null,
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'p1',
			userId: 'user_1',
		});
		expect(access.permissions.canView).toBe(false);
		expect(access.project).toBeNull();
	});

	it('lets a private-project member view but not manage it', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'private' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
			projectMember: { id: 'm1', role: 'member' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'p1',
			userId: 'user_1',
		});
		expect(access.permissions.canView).toBe(true);
		expect(access.permissions.canManageContent).toBe(false);
		expect(access.permissions.canEditSettings).toBe(false);
	});

	it('grants system admins full access to a private project', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'private' },
			profile: { id: 'profile_1', role: 'system:admin', userId: 'user_1' },
			projectMember: null,
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'p1',
			userId: 'user_1',
		});
		expect(access.permissions).toEqual({
			canDelete: true,
			canEditSettings: true,
			canManageAccess: true,
			canManageContent: true,
			canManageIntegrations: true,
			canView: true,
		});
	});

	// Archived projects report `isArchived: true` but KEEP role-derived
	// permissions so moderators/admins still see the settings UI. The read-only
	// freeze is enforced by `assertProjectWritable` at the mutations, not by
	// zeroing capabilities here.
	it('flags archived and keeps organization-admin full permissions', async () => {
		const ctx = makeAccessCtx({
			organizationMember: { id: 'm1', role: 'admin' },
			project: { id: 'p1', slug: 's', visibility: 'archived' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
		});
		const access = await verifyProjectAccess(ctx, {
			id: 'p1',
			userId: 'user_1',
		});
		expect(access.isArchived).toBe(true);
		expect(access.permissions.canView).toBe(true);
		expect(access.permissions.canManageContent).toBe(true);
		expect(access.permissions.canManageAccess).toBe(true);
		expect(access.permissions.canDelete).toBe(true);
	});

	it('flags archived and keeps assigned-moderator content/settings permissions', async () => {
		const ctx = makeAccessCtx({
			moderatorAssigned: true,
			organizationMember: { id: 'm1', role: 'moderator' },
			project: { id: 'p1', slug: 's', visibility: 'archived' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
		});
		const access = await verifyProjectAccess(ctx, { id: 'p1', userId: 'user_1' });
		expect(access.isArchived).toBe(true);
		expect(access.permissions.canView).toBe(true);
		expect(access.permissions.canManageContent).toBe(true);
		expect(access.permissions.canEditSettings).toBe(true);
		expect(access.permissions.canManageAccess).toBe(false);
		expect(access.permissions.canDelete).toBe(false);
	});

	it('flags archived for a system admin while keeping full permissions', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'archived' },
			profile: { id: 'profile_1', role: 'system:admin', userId: 'user_1' },
			projectMember: null,
		});
		const access = await verifyProjectAccess(ctx, { id: 'p1', userId: 'user_1' });
		expect(access.isArchived).toBe(true);
		expect(access.permissions.canManageContent).toBe(true);
		expect(access.permissions.canManageIntegrations).toBe(true);
		expect(access.permissions.canDelete).toBe(true);
	});

	it('hides an archived project from plain members', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'archived' },
			profile: { id: 'profile_1', role: 'user', userId: 'user_1' },
			projectMember: { id: 'm1', role: 'member' },
		});
		const access = await verifyProjectAccess(ctx, { id: 'p1', userId: 'user_1' });
		expect(access.permissions.canView).toBe(false);
		expect(access.project).toBeNull();
	});

	it('marks non-archived projects as writable', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'public' },
		});
		const access = await verifyProjectAccess(ctx, { id: 'p1' });
		expect(access.isArchived).toBe(false);
	});
});

describe('assertProjectWritable', () => {
	it('throws when the project is archived', () => {
		expect(() => assertProjectWritable({ isArchived: true })).toThrow(/archived/i);
	});

	it('is a no-op when the project is not archived', () => {
		expect(() => assertProjectWritable({ isArchived: false })).not.toThrow();
		expect(() => assertProjectWritable({})).not.toThrow();
	});
});

describe('sanitizeSystemRole', () => {
	it('passes through valid roles and downgrades the legacy system editor', () => {
		expect(sanitizeSystemRole('system:admin')).toBe('system:admin');
		expect(sanitizeSystemRole('system:editor')).toBe('user');
		expect(sanitizeSystemRole('user')).toBe('user');
	});

	it("collapses unknown/empty roles to 'user'", () => {
		expect(sanitizeSystemRole('admin')).toBe('user');
		expect(sanitizeSystemRole('owner')).toBe('user');
		expect(sanitizeSystemRole(null)).toBe('user');
		expect(sanitizeSystemRole(undefined)).toBe('user');
	});
});

describe('reconcileSystemRole', () => {
	function makeReconcileCtx(profile: { id: string; role: string; userId: string } | null) {
		const patches: Array<{ id: string; data: Record<string, unknown> }> = [];
		const ctx = {
			orm: { query: { profile: { findFirst: async () => profile } } },
			db: {
				patch: async (_table: string, id: string, data: Record<string, unknown>) => {
					patches.push({ id, data });
				},
			},
		} as any;
		return { ctx, patches };
	}

	it('patches profile.role to match user.role when drifted', async () => {
		const { ctx, patches } = makeReconcileCtx({
			id: 'p1',
			role: 'user',
			userId: 'u1',
		});
		const result = await reconcileSystemRole(ctx, {
			id: 'u1',
			role: 'system:admin',
		});
		expect(result).toBe('system:admin');
		expect(patches).toEqual([{ id: 'p1', data: { role: 'system:admin' } }]);
	});

	it('is a no-op when profile.role already matches', async () => {
		const { ctx, patches } = makeReconcileCtx({
			id: 'p1',
			role: 'system:admin',
			userId: 'u1',
		});
		await reconcileSystemRole(ctx, { id: 'u1', role: 'system:admin' });
		expect(patches).toEqual([]);
	});

	it('returns null when there is no profile yet', async () => {
		const { ctx } = makeReconcileCtx(null);
		expect(await reconcileSystemRole(ctx, { id: 'u1', role: 'user' })).toBeNull();
	});
});

describe('getProjectViewAccess', () => {
	it('fails closed (canView=false) when the project does not exist', async () => {
		const ctx = makeAccessCtx({ project: null });
		const access = await getProjectViewAccess(ctx, { id: 'missing' });
		expect(access.permissions.canView).toBe(false);
		expect(access.project).toBeNull();
	});

	it('delegates to project visibility for an anonymous viewer', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'public' },
		});
		const access = await getProjectViewAccess(ctx, { id: 'p1' });
		expect(access.permissions.canView).toBe(true);
	});

	it('denies an anonymous viewer access to a private project', async () => {
		const ctx = makeAccessCtx({
			project: { id: 'p1', slug: 's', visibility: 'private' },
		});
		const access = await getProjectViewAccess(ctx, { id: 'p1' });
		expect(access.permissions.canView).toBe(false);
	});
});

describe('verifyOrgAccess', () => {
	function makeOrgCtx(opts: {
		organization?: { id: string; slug: string; visibility: string } | null;
		profile?: { id: string; role: string; userId: string } | null;
		member?: { id: string; role: string } | null;
	}) {
		return {
			orm: {
				query: {
					organization: {
						findMany: async () => (opts.organization ? [opts.organization] : []),
					},
					profile: {
						findMany: async () => (opts.profile ? [opts.profile] : []),
					},
					member: {
						findMany: async () => (opts.member ? [opts.member] : []),
					},
				},
			},
		} as any;
	}

	it('fails closed (no permissions, no throw) when the org does not exist', async () => {
		const ctx = makeOrgCtx({ organization: null });
		const access = await verifyOrgAccess(ctx, {
			slug: 'missing',
			userId: 'u1',
		});
		expect(access.organization).toBeNull();
		expect(access.permissions).toEqual({
			canCreate: false,
			canDelete: false,
			canEdit: false,
			canView: false,
		});
	});

	it('grants an anonymous viewer read access to a public org', async () => {
		const ctx = makeOrgCtx({
			organization: { id: 'o1', slug: 'acme', visibility: 'public' },
		});
		const access = await verifyOrgAccess(ctx, { slug: 'acme' });
		expect(access.organization).not.toBeNull();
		expect(access.permissions.canView).toBe(true);
		expect(access.permissions.canEdit).toBe(false);
	});

	it('lets a moderator view the organization without managing it', async () => {
		const ctx = makeOrgCtx({
			member: { id: 'm1', role: 'moderator' },
			organization: { id: 'o1', slug: 'acme', visibility: 'private' },
			profile: { id: 'p1', role: 'user', userId: 'u1' },
		});
		const access = await verifyOrgAccess(ctx, { slug: 'acme', userId: 'u1' });
		expect(access.organization).not.toBeNull();
		expect(access.permissions).toEqual({
			canCreate: false,
			canDelete: false,
			canEdit: false,
			canView: true,
		});
	});
});
