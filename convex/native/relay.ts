import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError, v } from 'convex/values';

import { components } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { findMembership } from './access';
import { isFeedbackLive } from './feedbackLifecycle';
import { requireCurrentUser } from './identity';
import {
	createGitHubAppState,
	githubAppInstallationUrl,
	githubAppUserAuthorizationUrl,
	resolveGitHubCallbackTargetUrl,
	sha256Hex,
	verifyGitHubAppState,
} from './relayClient';
import {
	connectionView,
	githubInstallation,
	githubRepository,
	installationView,
	mode,
	source,
	verification,
} from './relaySchema';

const limits = new RateLimiter(components.authLimits, {
	relay: { kind: 'token bucket', rate: 20, period: 60_000, capacity: 20 },
});
export const slugs = { orgSlug: v.string(), projectSlug: v.optional(v.string()) };
export function view<T extends { _id: string; _creationTime: number }>(doc: T) {
	const { _id, _creationTime, ...fields } = doc;
	return { ...fields, id: _id as T['_id'] };
}
export async function manager(
	ctx: QueryCtx,
	args: { orgSlug: string; projectSlug?: string },
	userId?: Id<'users'>
) {
	const user = userId ? await ctx.db.get('users', userId) : await requireCurrentUser(ctx);
	if (!user || user.status !== 'active' || !user.profileId) throw new ConvexError('UNAUTHORIZED');
	const org = await ctx.db
		.query('organizations')
		.withIndex('by_slug', (q) => q.eq('slug', args.orgSlug))
		.unique();
	if (!org) throw new ConvexError('FORBIDDEN');
	const member = await findMembership(ctx, org._id, user._id);
	if (user.systemRole !== 'system:admin' && member?.role !== 'owner' && member?.role !== 'admin')
		throw new ConvexError('FORBIDDEN');
	const project = args.projectSlug
		? await ctx.db
				.query('projects')
				.withIndex('by_organizationId_and_slug', (q) =>
					q.eq('organizationId', org._id).eq('slug', args.projectSlug!)
				)
				.unique()
		: null;
	if (args.projectSlug && (!project || project.deletingAt !== undefined))
		throw new ConvexError('PROJECT_NOT_FOUND');
	return { user, org, project };
}
function writable(project: Doc<'projects'> | null) {
	if (project?.visibility === 'archived') throw new ConvexError('PROJECT_ARCHIVED');
}
async function boundedInstallations(ctx: QueryCtx, orgId: Id<'organizations'>) {
	const rows = await ctx.db
		.query('relayInstallations')
		.withIndex('by_orgId', (q) => q.eq('orgId', orgId))
		.take(101);
	if (rows.length > 100) throw new ConvexError('RELAY_CAPACITY');
	return rows;
}
async function liveConnections(ctx: QueryCtx, orgId: Id<'organizations'>) {
	const rows = await ctx.db
		.query('relayConnections')
		.withIndex('by_orgId_and_deletedTime', (q) => q.eq('orgId', orgId).eq('deletedTime', undefined))
		.take(501);
	if (rows.length > 500) throw new ConvexError('RELAY_CAPACITY');
	return rows;
}
export const start = mutation({
	args: {
		...slugs,
		mode: v.optional(mode),
		refresh: v.optional(v.boolean()),
		callbackTargetUrl: v.optional(v.string()),
	},
	returns: v.object({ url: v.string() }),
	handler: async (ctx, args) => {
		const { user, org, project } = await manager(ctx, args);
		writable(project);
		await limits.limit(ctx, 'relay', { key: user._id, throws: true });
		const nonce = crypto.randomUUID(),
			expiresAt = Date.now() + 600_000;
		const state = await createGitHubAppState({
			nonce,
			exp: expiresAt,
			targetUrl: resolveGitHubCallbackTargetUrl(args.callbackTargetUrl),
		});
		await ctx.db.insert('relayStates', {
			createdByUserId: user._id,
			orgId: org._id,
			orgSlug: org.slug,
			projectId: project?._id,
			projectSlug: project?.slug,
			mode: args.mode ?? 'read',
			hash: await sha256Hex(nonce),
			expiresAt,
		});
		return {
			url: args.refresh ? githubAppUserAuthorizationUrl(state) : githubAppInstallationUrl(state),
		};
	},
});
export const integration = query({
	args: slugs,
	returns: v.object({
		installations: v.array(installationView),
		staleInstallations: v.array(installationView),
		connections: v.array(connectionView),
	}),
	handler: async (ctx, args) => {
		const { org, project } = await manager(ctx, args);
		const rows = await boundedInstallations(ctx, org._id);
		const connections = project
			? await ctx.db
					.query('relayConnections')
					.withIndex('by_projectId_and_deletedTime', (q) =>
						q.eq('projectId', project._id).eq('deletedTime', undefined)
					)
					.take(2)
			: [];
		return {
			installations: rows.filter((i) => i.status === 'active').map(view),
			staleInstallations: rows.filter((i) => i.status === 'stale').map(view),
			connections: connections.map(view),
		};
	},
});
async function pending(ctx: QueryCtx, state: string) {
	const payload = await verifyGitHubAppState(state);
	const hash = await sha256Hex(payload.nonce);
	const row = await ctx.db
		.query('relayStates')
		.withIndex('by_hash', (q) => q.eq('hash', hash))
		.unique();
	if (!row || row.consumedAt !== undefined || row.expiresAt <= Date.now())
		throw new ConvexError('INVALID_RELAY_STATE');
	const access = await manager(ctx, row, row.createdByUserId);
	writable(access.project);
	if (access.org._id !== row.orgId || access.project?._id !== row.projectId)
		throw new ConvexError('INVALID_RELAY_STATE');
	return { row, access };
}
// A mutation intentionally checks wall-clock expiry and current membership.
export const callbackContext = internalMutation({
	args: { state: v.string() },
	returns: v.object({
		knownInstallationIds: v.array(v.number()),
		targets: v.array(
			v.object({
				accountId: v.number(),
				repositories: v.array(v.object({ id: v.number(), fullName: v.string() })),
			})
		),
	}),
	handler: async (ctx, { state }) => {
		const { row } = await pending(ctx, state),
			installations = await boundedInstallations(ctx, row.orgId),
			connections = await liveConnections(ctx, row.orgId);
		return {
			knownInstallationIds: installations
				.filter((i) => i.status === 'active' || i.status === 'stale')
				.map((i) => i.installationId),
			targets: installations.map((i) => ({
				accountId: i.accountId,
				repositories: connections
					.filter((c) => c.githubInstallationId === i._id)
					.map((c) => ({ id: c.repoId, fullName: c.repoFullName })),
			})),
		};
	},
});
export const complete = internalMutation({
	args: {
		state: v.string(),
		installations: v.array(
			v.object({ installation: githubInstallation, authorizedRepositoryIds: v.array(v.number()) })
		),
		deletedInstallationIds: v.array(v.number()),
	},
	returns: v.object(slugs),
	handler: async (ctx, args) => {
		const { row, access } = await pending(ctx, args.state);
		if (args.installations.length > 100 || args.deletedInstallationIds.length > 100)
			throw new ConvexError('RELAY_CAPACITY');
		const now = Date.now();
		for (const { installation: i, authorizedRepositoryIds } of args.installations) {
			if (!i.account) continue;
			if (authorizedRepositoryIds.length > 500) throw new ConvexError('RELAY_CAPACITY');
			const existing = await boundedInstallations(ctx, row.orgId);
			const connections = await liveConnections(ctx, row.orgId);
			const sameAccount = existing.filter((e) => e.accountId === i.account!.id);
			const exact = existing.find((e) => e.installationId === i.id);
			const candidate =
				exact ??
				sameAccount
					.sort(
						(a, b) =>
							Number(connections.some((c) => c.githubInstallationId === b._id)) -
								Number(connections.some((c) => c.githubInstallationId === a._id)) ||
							b.updatedTime - a.updatedTime
					)
					.at(0);
			const values = {
				orgId: row.orgId,
				orgSlug: row.orgSlug,
				connectedByProfileId: access.user.profileId!,
				installationId: i.id,
				accountId: i.account.id,
				accountLogin: i.account.login,
				accountType: i.account.type,
				events: i.events,
				permissions: i.permissions,
				repositorySelection: i.repository_selection,
				status: 'active' as const,
				updatedTime: now,
			};
			if (!candidate && existing.length === 100) throw new ConvexError('RELAY_CAPACITY');
			const id = candidate ? candidate._id : await ctx.db.insert('relayInstallations', values);
			if (candidate) await ctx.db.patch('relayInstallations', id, values);
			const sameIds = new Set(sameAccount.map((e) => e._id));
			sameIds.add(id);
			for (const c of connections) {
				if (!sameIds.has(c.githubInstallationId)) continue;
				if (!authorizedRepositoryIds.includes(c.repoId))
					await ctx.db.patch('relayConnections', c._id, {
						deletedTime: now,
						verificationStatus: 'unauthorized',
						updatedTime: now,
					});
				else
					await ctx.db.patch('relayConnections', c._id, {
						githubInstallationId: id,
						updatedTime: now,
					});
			}
		}
		for (const installationId of args.deletedInstallationIds) {
			const i = await ctx.db
				.query('relayInstallations')
				.withIndex('by_orgId_and_installationId', (q) =>
					q.eq('orgId', row.orgId).eq('installationId', installationId)
				)
				.unique();
			if (i)
				await ctx.db.patch('relayInstallations', i._id, { status: 'deleted', updatedTime: now });
		}
		await ctx.db.patch('relayStates', row._id, { consumedAt: now });
		return { orgSlug: row.orgSlug, projectSlug: row.projectSlug };
	},
});
export const installationContext = internalQuery({
	args: { ...slugs, installationId: v.number() },
	returns: installationView,
	handler: async (ctx, args) => {
		const { org, project } = await manager(ctx, args);
		writable(project);
		const row = await ctx.db
			.query('relayInstallations')
			.withIndex('by_orgId_and_installationId', (q) =>
				q.eq('orgId', org._id).eq('installationId', args.installationId)
			)
			.unique();
		if (!row || row.status !== 'active') throw new ConvexError('GitHub installation not found');
		return view(row);
	},
});
export const reserveAction = internalMutation({
	args: slugs,
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user, project } = await manager(ctx, args);
		writable(project);
		await limits.limit(ctx, 'relay', { key: user._id, throws: true });
		return null;
	},
});
export const stale = internalMutation({
	args: { id: v.id('relayInstallations') },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const row = await ctx.db.get('relayInstallations', id);
		if (row?.status === 'active')
			await ctx.db.patch('relayInstallations', id, { status: 'stale', updatedTime: Date.now() });
		return null;
	},
});
export const saveRepository = internalMutation({
	args: {
		orgSlug: v.string(),
		projectSlug: v.string(),
		installationId: v.number(),
		installationRowId: v.id('relayInstallations'),
		repository: githubRepository,
		mode,
		enabledSources: v.array(source),
		verificationSummary: verification,
	},
	returns: v.object({ connectionId: v.id('relayConnections') }),
	handler: async (ctx, args) => {
		const { org, project, user } = await manager(ctx, args);
		writable(project);
		const i = await ctx.db.get('relayInstallations', args.installationRowId);
		if (
			!i ||
			i.orgId !== org._id ||
			i.installationId !== args.installationId ||
			i.status !== 'active'
		)
			throw new ConvexError('GitHub installation not found');
		if (!project || !args.enabledSources.length || args.enabledSources.length > 2)
			throw new ConvexError('INVALID_ARGUMENT');
		if (
			(args.enabledSources.includes('issues') && !args.verificationSummary.issues.ok) ||
			(args.enabledSources.includes('discussions') &&
				(!args.verificationSummary.discussions.ok || !args.verificationSummary.discussions.enabled))
		)
			throw new ConvexError('RELAY_VERIFICATION_FAILED');
		const existing = await ctx.db
			.query('relayConnections')
			.withIndex('by_orgId_and_repoId', (q) =>
				q.eq('orgId', org._id).eq('repoId', args.repository.id)
			)
			.unique();
		if (existing && existing.deletedTime === undefined && existing.projectId !== project._id)
			throw new ConvexError('This GitHub repository is already connected to another Kino project');
		const now = Date.now();
		const current = await ctx.db
			.query('relayConnections')
			.withIndex('by_projectId_and_deletedTime', (q) =>
				q.eq('projectId', project._id).eq('deletedTime', undefined)
			)
			.take(2);
		for (const c of current)
			if (c._id !== existing?._id)
				await ctx.db.patch('relayConnections', c._id, { deletedTime: now, updatedTime: now });
		const r = args.repository;
		const fields = {
			orgId: org._id,
			orgSlug: org.slug,
			projectId: project._id,
			projectSlug: project.slug,
			connectedByProfileId: user.profileId!,
			githubInstallationId: i._id,
			repoId: r.id,
			repoNodeId: r.node_id,
			repoName: r.name,
			repoFullName: r.full_name,
			repoOwner: r.owner.login,
			repoPrivate: r.private,
			mode: args.mode,
			enabledSources: args.enabledSources,
			verificationStatus: 'verified',
			verificationSummary: args.verificationSummary,
			updatedTime: now,
			deletedTime: undefined,
		};
		if (existing) {
			await ctx.db.patch('relayConnections', existing._id, fields);
			return { connectionId: existing._id };
		}
		return { connectionId: await ctx.db.insert('relayConnections', fields) };
	},
});
export const disconnectRepository = mutation({
	args: { orgSlug: v.string(), projectSlug: v.string(), connectionId: v.id('relayConnections') },
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		const { project } = await manager(ctx, args);
		writable(project);
		const c = await ctx.db.get('relayConnections', args.connectionId);
		if (!c || c.projectId !== project?._id || c.deletedTime !== undefined)
			throw new ConvexError('GitHub repository connection not found');
		await ctx.db.patch('relayConnections', c._id, {
			deletedTime: Date.now(),
			updatedTime: Date.now(),
		});
		return { success: true };
	},
});
export const webhook = internalMutation({
	args: {
		deliveryId: v.string(),
		event: v.string(),
		action: v.optional(v.string()),
		installationId: v.optional(v.number()),
		removedRepositoryIds: v.optional(v.array(v.number())),
		permissions: v.optional(v.record(v.string(), v.string())),
		events: v.optional(v.array(v.string())),
		issue: v.optional(
			v.object({
				repositoryId: v.number(),
				nodeId: v.string(),
				number: v.number(),
				title: v.string(),
				state: v.string(),
				url: v.string(),
			})
		),
	},
	returns: v.object({
		duplicate: v.boolean(),
		result: v.union(v.literal('ignored'), v.literal('processed')),
	}),
	handler: async (ctx, args) => {
		const old = await ctx.db
			.query('relayDeliveries')
			.withIndex('by_deliveryId', (q) => q.eq('deliveryId', args.deliveryId))
			.unique();
		if (old) return { duplicate: true, result: old.result };
		let result: 'ignored' | 'processed' = 'ignored';
		if (args.installationId !== undefined) {
			const installations = await ctx.db
				.query('relayInstallations')
				.withIndex('by_installationId', (q) => q.eq('installationId', args.installationId!))
				.take(101);
			if (installations.length > 100) throw new ConvexError('RELAY_CAPACITY');
			for (const i of installations) {
				if (args.event === 'installation_repositories' && args.removedRepositoryIds) {
					if (args.removedRepositoryIds.length > 500) throw new ConvexError('RELAY_CAPACITY');
					for (const repoId of args.removedRepositoryIds) {
						const c = await ctx.db
							.query('relayConnections')
							.withIndex('by_orgId_and_repoId', (q) => q.eq('orgId', i.orgId).eq('repoId', repoId))
							.unique();
						if (c && c.githubInstallationId === i._id && c.deletedTime === undefined) {
							await ctx.db.patch('relayConnections', c._id, {
								deletedTime: Date.now(),
								updatedTime: Date.now(),
								verificationStatus: 'unauthorized',
							});
							result = 'processed';
						}
					}
				}
				if (args.event === 'installation') {
					const status =
						args.action === 'deleted'
							? 'deleted'
							: args.action === 'suspend'
								? 'suspended'
								: args.action === 'unsuspend'
									? 'active'
									: null;
					if (status || args.action === 'new_permissions_accepted') {
						await ctx.db.patch('relayInstallations', i._id, {
							...(status ? { status } : {}),
							...(args.permissions ? { permissions: args.permissions } : {}),
							...(args.events ? { events: args.events } : {}),
							updatedTime: Date.now(),
						});
						result = 'processed';
					}
				}
				if (
					(args.event === 'issues' || args.event === 'issue_comment') &&
					args.issue &&
					i.status === 'active'
				) {
					const issue = args.issue;
					const c = await ctx.db
						.query('relayConnections')
						.withIndex('by_orgId_and_repoId', (q) =>
							q.eq('orgId', i.orgId).eq('repoId', issue.repositoryId)
						)
						.unique();
					if (
						!c ||
						c.githubInstallationId !== i._id ||
						c.deletedTime !== undefined ||
						!c.enabledSources.includes('issues')
					)
						continue;
					const project = await ctx.db.get('projects', c.projectId);
					if (!project || project.deletingAt !== undefined || project.visibility === 'archived')
						continue;
					const links = await ctx.db
						.query('relayIssues')
						.withIndex('by_githubRepositoryConnectionId_and_githubNodeId', (q) =>
							q.eq('githubRepositoryConnectionId', c._id).eq('githubNodeId', issue.nodeId)
						)
						.take(101);
					if (links.length > 100) throw new ConvexError('RELAY_CAPACITY');
					for (const link of links) {
						const feedback = await ctx.db.get('feedback', link.feedbackId);
						if (!(await isFeedbackLive(ctx, feedback))) continue;
						await ctx.db.patch('relayIssues', link._id, {
							githubNumber: issue.number,
							title: issue.title,
							state: issue.state,
							url: issue.url,
							updatedTime: Date.now(),
						});
						result = 'processed';
					}
				}
			}
		}
		await ctx.db.insert('relayDeliveries', {
			deliveryId: args.deliveryId,
			event: args.event,
			result,
			receivedAt: Date.now(),
		});
		return { duplicate: false, result };
	},
});
