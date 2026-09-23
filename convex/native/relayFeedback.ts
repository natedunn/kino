import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';
import { assertProjectWritable, requireProjectAccess, resolveProjectAccess } from './access';
import { isFeedbackLive } from './feedbackLifecycle';
import { requireCurrentUser } from './identity';
import { view } from './relay';
import { connectionView, installationView, issueView, mode, source } from './relaySchema';

export async function verified(ctx: QueryCtx, feedbackId: Id<'feedback'>, write = true) {
	const feedback = await ctx.db.get('feedback', feedbackId);
	if (!feedback || !(await isFeedbackLive(ctx, feedback)))
		throw new ConvexError('FEEDBACK_NOT_FOUND');
	const access = await requireProjectAccess(ctx, feedback.projectId);
	assertProjectWritable(access);
	if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
	const user = await requireCurrentUser(ctx);
	if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
	const connection = await ctx.db
		.query('relayConnections')
		.withIndex('by_projectId_and_deletedTime', (q) =>
			q.eq('projectId', feedback.projectId).eq('deletedTime', undefined)
		)
		.unique();
	if (!connection) throw new ConvexError('GitHub repository connection not found');
	if (write && (connection.mode !== 'read_write' || !connection.enabledSources.includes('issues')))
		throw new ConvexError('FORBIDDEN');
	const installation = await ctx.db.get('relayInstallations', connection.githubInstallationId);
	if (!installation || installation.status !== 'active')
		throw new ConvexError('GitHub installation not found');
	return { feedback, connection, installation, user };
}
export const context = internalQuery({
	args: { feedbackId: v.id('feedback') },
	returns: v.object({
		connection: connectionView,
		installation: installationView,
		feedbackTitle: v.string(),
		profileId: v.id('profiles'),
	}),
	handler: async (ctx, { feedbackId }) => {
		const c = await verified(ctx, feedbackId);
		return {
			connection: view(c.connection),
			installation: view(c.installation),
			feedbackTitle: c.feedback.title,
			profileId: c.user.profileId!,
		};
	},
});
export const getAvailability = query({
	args: { feedbackId: v.id('feedback') },
	returns: v.object({
		connected: v.boolean(),
		enabledSources: v.array(source),
		issuesEnabled: v.boolean(),
		mode: v.union(v.null(), mode),
		repoFullName: v.union(v.null(), v.string()),
		repoPrivate: v.boolean(),
		writable: v.boolean(),
	}),
	handler: async (ctx, { feedbackId }) => {
		const feedback = await ctx.db.get('feedback', feedbackId);
		if (!feedback || !(await isFeedbackLive(ctx, feedback)))
			throw new ConvexError('FEEDBACK_NOT_FOUND');
		const access = await requireProjectAccess(ctx, feedback.projectId);
		if (!access.permissions.canManageContent) throw new ConvexError('FORBIDDEN');
		const c = await ctx.db
			.query('relayConnections')
			.withIndex('by_projectId_and_deletedTime', (q) =>
				q.eq('projectId', feedback.projectId).eq('deletedTime', undefined)
			)
			.unique();
		const i = c && (await ctx.db.get('relayInstallations', c.githubInstallationId));
		const connected = !!c && i?.status === 'active';
		return {
			connected,
			enabledSources: connected ? c.enabledSources : [],
			issuesEnabled: !!connected && c.enabledSources.includes('issues'),
			mode: connected ? c.mode : null,
			repoFullName: connected ? c.repoFullName : null,
			repoPrivate: !!connected && c.repoPrivate,
			writable: !!connected && c.mode === 'read_write' && !access.isArchived,
		};
	},
});
export const listByFeedback = query({
	args: { feedbackId: v.id('feedback') },
	returns: v.array(issueView),
	handler: async (ctx, { feedbackId }) => {
		const f = await ctx.db.get('feedback', feedbackId);
		if (!f || !(await isFeedbackLive(ctx, f))) return [];
		const access = await resolveProjectAccess(ctx, f.projectId);
		if (!access.project) return [];
		const rows = await ctx.db
			.query('relayIssues')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedbackId))
			.take(100);
		const visible = [];
		for (const row of rows) {
			const c = await ctx.db.get('relayConnections', row.githubRepositoryConnectionId);
			if (
				!c ||
				c.deletedTime !== undefined ||
				(c.repoPrivate && !access.permissions.canManageContent)
			)
				continue;
			const i = await ctx.db.get('relayInstallations', c.githubInstallationId);
			if (i?.status === 'active') visible.push(view(row));
		}
		return visible;
	},
});
export const target = v.object({
	databaseId: v.number(),
	nodeId: v.string(),
	number: v.number(),
	title: v.string(),
	url: v.string(),
	state: v.string(),
});
export const save = internalMutation({
	args: {
		feedbackId: v.id('feedback'),
		connectionId: v.id('relayConnections'),
		target,
		refresh: v.optional(v.boolean()),
	},
	returns: v.object({ connectionId: v.id('relayIssues') }),
	handler: async (ctx, args) => {
		const c = await verified(ctx, args.feedbackId);
		if (c.connection._id !== args.connectionId) throw new ConvexError('RELAY_CONNECTION_CHANGED');
		const old = await ctx.db
			.query('relayIssues')
			.withIndex('by_feedbackId_and_githubNodeId', (q) =>
				q.eq('feedbackId', args.feedbackId).eq('githubNodeId', args.target.nodeId)
			)
			.unique();
		if (old && !args.refresh)
			throw new ConvexError('This GitHub item is already connected to this feedback');
		if (old && old.githubRepositoryConnectionId !== args.connectionId)
			throw new ConvexError('RELAY_CONNECTION_CHANGED');
		const links = await ctx.db
			.query('relayIssues')
			.withIndex('by_feedbackId', (q) => q.eq('feedbackId', args.feedbackId))
			.take(100);
		if (!old && links.length >= 100) throw new ConvexError('RELAY_CAPACITY');
		const t = args.target,
			fields = {
				projectId: c.feedback.projectId,
				feedbackId: args.feedbackId,
				connectedByProfileId: c.user.profileId!,
				githubRepositoryConnectionId: args.connectionId,
				kind: 'issue' as const,
				githubNodeId: t.nodeId,
				githubDatabaseId: t.databaseId,
				githubNumber: t.number,
				title: t.title,
				url: t.url,
				state: t.state,
				updatedTime: Date.now(),
			};
		if (old) {
			await ctx.db.patch('relayIssues', old._id, fields);
			return { connectionId: old._id };
		}
		return { connectionId: await ctx.db.insert('relayIssues', fields) };
	},
});
