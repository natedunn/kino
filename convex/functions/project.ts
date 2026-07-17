import { v } from 'convex/values';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery, optionalAuthQuery, privateQuery } from '../lib/crpc';
import {
	asId,
	getCurrentProfile,
	LIMITS,
	toPublicDoc,
	verifyOrgAccess,
	verifyProjectAccess,
} from '../lib/kino';
import {
	idSchema,
	orgSlugSchema,
	projectDescriptionSchema,
	projectNameSchema,
	projectSlugSchema,
	projectSlugWriteSchema,
	urlListSchema,
} from '../lib/validation';
import { internal } from './_generated/api';
import { internalMutation, withOrm } from './generated/server';
import {
	getActiveRepoConnection,
	normalizeUrl,
	PROJECT_PURGE_BATCH_SIZE,
	repoCanonicalUrl,
	visibilitySchema,
} from './project.lib';
import {
	feedbackBoardTable,
	feedbackGithubConnectionTable,
	feedbackTable,
	projectMemberTable,
	projectTable,
	updateTable,
} from './schema';

export const create = authMutation
	.input(
		z.object({
			description: projectDescriptionSchema.optional(),
			name: projectNameSchema,
			orgSlug: orgSlugSchema,
			slug: projectSlugWriteSchema,
			urls: urlListSchema.optional(),
			visibility: visibilitySchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const access = await verifyOrgAccess(ctx, {
			slug: input.orgSlug,
			userId: ctx.userId,
		});
		if (!access.organization) {
			throw new CRPCError({
				code: 'NOT_FOUND',
				message: 'Organization not found',
			});
		}

		if (!access.permissions.canCreate) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'User does not have permission to create a project',
			});
		}

		const projects = await ctx.orm.query.project.findMany({
			where: { orgSlug: input.orgSlug },
			limit: LIMITS.ADMIN.MAX_PROJECTS + 1,
		});
		const maxProjects =
			access.profile.role === 'system:admin' ? LIMITS.ADMIN.MAX_PROJECTS : LIMITS.FREE.MAX_PROJECTS;
		if (projects.length >= maxProjects) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'Project limit reached',
			});
		}

		const existing = await ctx.db
			.query('project')
			.withIndex('by_orgSlug_slug', (q: any) =>
				q.eq('orgSlug', input.orgSlug).eq('slug', input.slug)
			)
			.unique();
		if (existing) {
			throw new CRPCError({
				code: 'CONFLICT',
				message: `A project with the slug '${input.slug}' already exists for this organization.`,
			});
		}

		const [project] = await ctx.orm
			.insert(projectTable)
			.values({
				description: input.description ?? null,
				logoUrl: null,
				name: input.name,
				orgSlug: input.orgSlug,
				slug: input.slug,
				urls:
					input.urls?.map((entry) => ({
						source: 'manual',
						text: entry.text,
						url: entry.url,
						verifiedAt: null,
					})) ?? null,
				visibility: input.visibility,
			})
			.returning();

		return project;
	});

export const update = authMutation
	// NOTE: `orgSlug` is intentionally NOT updatable here. Allowing it would let
	// an editor re-parent a project into another org's slug namespace without any
	// permission check on the destination org. A project's org is fixed at
	// creation; the org slug only ever changes via the org-rename trigger, which
	// re-denormalizes every project's `orgSlug` server-side.
	.input(
		z.object({
			description: projectDescriptionSchema.optional(),
			id: idSchema,
			name: projectNameSchema.optional(),
			slug: projectSlugWriteSchema.optional(),
			urls: urlListSchema.optional(),
			visibility: visibilitySchema.optional(),
		})
	)
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.id,
			userId: ctx.userId,
		});
		if (!access.project) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
		}
		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'User does not have permission',
			});
		}

		if (input.slug && input.slug !== access.project.slug) {
			const existing = await ctx.db
				.query('project')
				.withIndex('by_orgSlug_slug', (q: any) =>
					q.eq('orgSlug', access.project.orgSlug).eq('slug', input.slug)
				)
				.unique();
			if (existing && existing._id !== access.project._id) {
				throw new CRPCError({
					code: 'CONFLICT',
					message: `A project with the slug '${input.slug}' already exists for this organization.`,
				});
			}
		}

		const patch: Record<string, unknown> = Object.fromEntries(
			Object.entries({
				description: input.description,
				name: input.name,
				slug: input.slug,
				visibility: input.visibility,
			}).filter(([, value]) => value !== undefined)
		);

		if (input.urls !== undefined) {
			// Links save as one list with the rest of the form. `source: "github"` is
			// only a client hint — a link is stored verified ONLY if its URL matches a
			// repo actually connected to this project, so the client can't forge one.
			const connections = await ctx.db
				.query('githubRepositoryConnection')
				.withIndex('by_projectId', (q: any) => q.eq('projectId', access.project._id))
				// Newest-first so an active connection isn't paged out by stale
				// (disconnected) history and legitimate github links don't get downgraded.
				.order('desc')
				.take(20);
			const verifiableUrls = new Set(
				connections
					.filter((connection: any) => !connection.deletedTime)
					.map((connection: any) => normalizeUrl(repoCanonicalUrl(connection.repoFullName)))
			);
			const existingVerifiedAt = new Map(
				((access.project.urls ?? []) as Array<any>)
					.filter((entry) => entry.source === 'github')
					.map((entry) => [normalizeUrl(entry.url), entry.verifiedAt as number])
			);

			patch.urls = input.urls.map((entry) => {
				const normalized = normalizeUrl(entry.url);
				const verified = entry.source === 'github' && verifiableUrls.has(normalized);
				return {
					source: verified ? 'github' : 'manual',
					text: entry.text,
					url: entry.url,
					verifiedAt: verified ? (existingVerifiedAt.get(normalized) ?? Date.now()) : null,
				};
			});
		}

		await ctx.orm.update(projectTable).set(patch).where(eq(projectTable.id, access.project._id));
		return {
			...access.project,
			...patch,
		};
	});

export const getManyByOrg = optionalAuthQuery
	.input(
		z.object({
			limit: z.number().min(1).max(100).optional(),
			orgSlug: orgSlugSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const limit = input.limit ?? 10;
		const publicProjects = await ctx.orm.query.project.findMany({
			where: { orgSlug: input.orgSlug, visibility: 'public' },
			limit,
			orderBy: { updatedTime: 'desc' },
		});

		const access = ctx.userId
			? await verifyOrgAccess(ctx, { slug: input.orgSlug, userId: ctx.userId })
			: null;

		// Org managers (admin/editor/owner) and system roles see every project.
		// A public org's canView does NOT imply private-project visibility, so we
		// gate private/archived on canEdit, not canView.
		if (access?.permissions.canEdit) {
			const [privateProjects, archivedProjects] = await Promise.all([
				ctx.orm.query.project.findMany({
					where: { orgSlug: input.orgSlug, visibility: 'private' },
					limit,
					orderBy: { updatedTime: 'desc' },
				}),
				ctx.orm.query.project.findMany({
					where: { orgSlug: input.orgSlug, visibility: 'archived' },
					limit,
					orderBy: { updatedTime: 'desc' },
				}),
			]);

			const merged = [...publicProjects, ...privateProjects, ...archivedProjects]
				.filter((project: any) => project.deletedTime == null)
				.sort((a, b) => (b.updatedTime ?? 0) - (a.updatedTime ?? 0))
				.slice(0, limit);

			return merged.length > 0 ? merged : null;
		}

		// Everyone else: public projects, plus any PRIVATE project the current
		// user is a direct member of (so invited members can reach it). No archived.
		const profile = ctx.userId ? await getCurrentProfile(ctx, ctx.userId) : null;
		if (!profile) {
			const visible = publicProjects.filter((project: any) => project.deletedTime == null);
			return visible.length > 0 ? visible : null;
		}

		const memberships = await ctx.orm.query.projectMember.findMany({
			where: { profileId: asId<'profile'>(profile._id) },
			limit: 500,
		});
		const memberProjectIds = memberships.map((membership: any) =>
			asId<'project'>(membership.projectId)
		);

		// Load the member's projects directly by id (point lookups) so visibility
		// doesn't depend on a recency window of the org's private projects.
		let memberPrivateProjects: typeof publicProjects = [];
		if (memberProjectIds.length > 0) {
			const memberProjects = await ctx.orm.query.project.findMany({
				where: { id: { in: memberProjectIds } },
				limit: 500,
			});
			memberPrivateProjects = memberProjects.filter(
				(project: any) => project.orgSlug === input.orgSlug && project.visibility === 'private'
			);
		}

		const merged = [...publicProjects, ...memberPrivateProjects]
			.filter((project: any) => project.deletedTime == null)
			.sort((a, b) => (b.updatedTime ?? 0) - (a.updatedTime ?? 0))
			.slice(0, limit);

		return merged.length > 0 ? merged : null;
	});

export const getDetails = optionalAuthQuery
	.input(
		z.object({
			orgSlug: orgSlugSchema,
			slug: projectSlugSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const project = await ctx.db
			.query('project')
			.withIndex('by_orgSlug_slug', (q: any) =>
				q.eq('orgSlug', input.orgSlug).eq('slug', input.slug)
			)
			.unique();
		// Ignore soft-deleted projects (set by `remove`, awaiting purge).
		if (!project || project.deletedTime != null) return null;

		const access = await verifyProjectAccess(ctx, {
			id: project._id,
			userId: ctx.userId,
		});
		if (!access.project || !access.permissions.canView) {
			return null;
		}

		return {
			...access,
			profile: toPublicDoc(access.profile),
			project: toPublicDoc(access.project),
			projectMember: toPublicDoc(access.projectMember),
		};
	});

// Lightweight, client-facing check powering the "import from GitHub" notice:
// does this project have a connected repo the current editor could import from?
export const getGithubImportInfo = authQuery
	.input(z.object({ id: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.id,
			userId: ctx.userId,
		});
		if (!access.project || !access.permissions.canEdit) {
			return { connected: false, repoFullName: null };
		}
		const connection = await getActiveRepoConnection(ctx, access.project._id);
		return {
			connected: !!connection,
			repoFullName: connection?.repoFullName ?? null,
		};
	});

// Resolves the installation + repo the `importGithubUrls` action needs before it
// can mint a token and fetch repo metadata. Internal — called by the action.
export const prepareGithubUrlImport = privateQuery
	.input(z.object({ id: idSchema, userId: idSchema }))
	.query(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.id,
			userId: input.userId,
		});
		if (!access.project) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
		}
		if (!access.permissions.canEdit) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'User does not have permission',
			});
		}
		const connection = await getActiveRepoConnection(ctx, access.project._id);
		if (!connection) {
			throw new CRPCError({
				code: 'NOT_FOUND',
				message: 'No connected GitHub repository for this project',
			});
		}
		const installation: any = await ctx.db.get(connection.githubInstallationId);
		if (!installation || installation.status !== 'active') {
			throw new CRPCError({
				code: 'NOT_FOUND',
				message: 'GitHub installation is no longer active',
			});
		}
		return {
			installationId: installation.installationId as number,
			repoFullName: connection.repoFullName as string,
			repoId: connection.repoId as number,
			repoName: connection.repoName as string,
		};
	});

export const remove = authMutation
	.input(z.object({ id: idSchema }))
	.mutation(async ({ ctx, input }) => {
		const access = await verifyProjectAccess(ctx, {
			id: input.id,
			userId: ctx.userId,
		});
		// `verifyProjectAccess` already treats soft-deleted projects as not found,
		// so a repeated delete simply 404s here (fine — it's already gone).
		if (!access.project) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
		}
		if (!access.permissions.canDelete) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'User does not have permission to delete this project',
			});
		}

		// Soft-hide first so the project leaves every listing immediately, then
		// purge its children in the background before removing the row.
		const now = Date.now();
		await ctx.orm
			.update(projectTable)
			.set({ deletedTime: now, updatedTime: now })
			.where(eq(projectTable.id, access.project._id));
		await ctx.scheduler.runAfter(0, internal.project.purgeProject, {
			projectId: access.project._id,
		});
		return { success: true };
	});

// Deletes a soft-hidden project's children in bounded batches, rescheduling
// itself until every child table is empty, then removes the project row.
// Internal only — entered via `_delete`'s scheduler call. Boards are purged
// first because each board delete cascades its whole feedback tree.
export const purgeProject = internalMutation({
	args: { projectId: v.id('project') },
	handler: async (ctx, { projectId }) => {
		const octx = withOrm(ctx);

		// Safety: only purge projects `remove` has soft-deleted. If the row is gone
		// (already purged) or was never soft-deleted, do nothing — this internal
		// mutation must never irreversibly wipe an active project.
		const project: any = await ctx.db.get(projectId);
		if (!project || project.deletedTime == null) return null;

		// Each entry: a table + its ORM delete, purged before the project row.
		// Order matters only in that heavy trees (boards, updates) go first.
		const purgeSteps: Array<{
			query: () => Promise<Array<{ _id: string }>>;
			remove: (id: string) => Promise<unknown>;
		}> = [
			{
				query: () =>
					ctx.db
						.query('feedbackBoard')
						.withIndex('by_projectId', (q: any) => q.eq('projectId', projectId))
						.take(PROJECT_PURGE_BATCH_SIZE),
				remove: (id) =>
					octx.orm.delete(feedbackBoardTable).where(eq(feedbackBoardTable.id, id as any)),
			},
			{
				query: () =>
					ctx.db
						.query('update')
						.withIndex('by_projectId_updatedTime', (q: any) => q.eq('projectId', projectId))
						.take(PROJECT_PURGE_BATCH_SIZE),
				remove: (id) => octx.orm.delete(updateTable).where(eq(updateTable.id, id as any)),
			},
			// Safety nets for the two child tables whose projectId FK is non-cascading
			// (feedback, feedbackGithubConnection). Board/feedback cascades normally
			// clear these, but purge any stragglers directly before dropping the row.
			{
				query: () =>
					ctx.db
						.query('feedbackGithubConnection')
						.withIndex('by_projectId', (q: any) => q.eq('projectId', projectId))
						.take(PROJECT_PURGE_BATCH_SIZE),
				remove: (id) =>
					octx.orm
						.delete(feedbackGithubConnectionTable)
						.where(eq(feedbackGithubConnectionTable.id, id as any)),
			},
			{
				query: () =>
					ctx.db
						.query('feedback')
						.withIndex('by_projectId', (q: any) => q.eq('projectId', projectId))
						.take(PROJECT_PURGE_BATCH_SIZE),
				remove: (id) => octx.orm.delete(feedbackTable).where(eq(feedbackTable.id, id as any)),
			},
			{
				query: () =>
					ctx.db
						.query('projectMember')
						.withIndex('by_projectId', (q: any) => q.eq('projectId', projectId))
						.take(PROJECT_PURGE_BATCH_SIZE),
				remove: (id) =>
					octx.orm.delete(projectMemberTable).where(eq(projectMemberTable.id, id as any)),
			},
		];

		for (const step of purgeSteps) {
			const batch = await step.query();
			for (const row of batch) {
				await step.remove(row._id);
			}
			if (batch.length === PROJECT_PURGE_BATCH_SIZE) {
				// A full batch likely means more remain; continue before touching later
				// steps or the project row.
				await ctx.scheduler.runAfter(0, internal.project.purgeProject, {
					projectId,
				});
				return null;
			}
		}

		// Every child table is empty — remove the (already soft-hidden) project.
		await octx.orm.delete(projectTable).where(eq(projectTable.id, projectId as any));
		return null;
	},
});
