import { RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError, v } from 'convex/values';

import { feedbackSearchSchema, githubBodySchema, githubTitleSchema } from '../shared/validation';
import { api, components, internal } from './_generated/api';
import { action, env } from './_generated/server';
import { tokenWithRecovery } from './relayActions';
import {
	createIssueComment,
	createRepositoryIssue,
	getRepositoryIssue,
	searchRepositoryIssues,
} from './relayClient';
import { target } from './relayFeedback';

const limits = new RateLimiter(components.authLimits, {
	relayIssue: { kind: 'token bucket', rate: 20, period: 60_000, capacity: 20 },
});
const args = { feedbackId: v.id('feedback'), kind: v.literal('issue') };
export const searchTargets = action({
	args: { ...args, query: v.string() },
	returns: v.array(v.object({ ...target.fields, kind: v.literal('issue') })),
	handler: async (ctx, input) => {
		const c = await ctx.runQuery(internal.relayFeedback.context, { feedbackId: input.feedbackId });
		await limits.limit(ctx, 'relayIssue', { key: c.profileId, throws: true });
		const token = await tokenWithRecovery(ctx, c.installation, 'read', [c.connection.repoId]);
		const issues = await searchRepositoryIssues({
			repository: repo(c.connection),
			token: token.token,
			query: feedbackSearchSchema.parse(input.query),
		});
		await ctx.runQuery(internal.relayFeedback.context, { feedbackId: input.feedbackId });
		return issues.map((i) => ({ ...i, kind: 'issue' as const }));
	},
});
function repo(c: {
	repoId: number;
	repoFullName: string;
	repoName: string;
	repoNodeId: string;
	repoOwner: string;
	repoPrivate: boolean;
}) {
	return {
		id: c.repoId,
		full_name: c.repoFullName,
		name: c.repoName,
		node_id: c.repoNodeId,
		owner: { login: c.repoOwner },
		private: c.repoPrivate,
	};
}
export const connect = action({
	args: {
		...args,
		feedbackUrl: v.string(),
		githubNumber: v.optional(v.number()),
		title: v.optional(v.string()),
		body: v.optional(v.string()),
	},
	returns: v.object({ connectionId: v.id('relayIssues') }),
	handler: async (ctx, input) => {
		const c = await ctx.runQuery(internal.relayFeedback.context, { feedbackId: input.feedbackId });
		await limits.limit(ctx, 'relayIssue', { key: c.profileId, throws: true });
		const url = new URL(input.feedbackUrl);
		if (url.origin !== new URL(env.AUTH_APP_ORIGIN).origin) throw new ConvexError('INVALID_URL');
		const token = await tokenWithRecovery(ctx, c.installation, 'read_write', [c.connection.repoId]),
			repository = repo(c.connection);
		const backlink = `Connected to Kino Feedback: [${c.feedbackTitle}](${url.href})`;
		let issue: Awaited<ReturnType<typeof getRepositoryIssue>>;
		if (input.githubNumber !== undefined) {
			if (!Number.isSafeInteger(input.githubNumber) || input.githubNumber <= 0)
				throw new ConvexError('INVALID_ARGUMENT');
			issue = await getRepositoryIssue({
				repository,
				token: token.token,
				issueNumber: input.githubNumber,
			});
			const links = await ctx.runQuery(api.relayFeedback.listByFeedback, {
				feedbackId: input.feedbackId,
			});
			if (links.some((i) => i.githubNodeId === issue.nodeId))
				throw new ConvexError('This GitHub item is already connected to this feedback');
			await ctx.runQuery(internal.relayFeedback.context, { feedbackId: input.feedbackId });
			await createIssueComment({
				repository,
				token: token.token,
				issueNumber: input.githubNumber,
				body: backlink,
			});
		} else {
			const title = githubTitleSchema.parse(input.title),
				body = githubBodySchema.parse(input.body ?? '');
			await ctx.runQuery(internal.relayFeedback.context, { feedbackId: input.feedbackId });
			issue = await createRepositoryIssue({
				repository,
				token: token.token,
				title,
				body: [body.trim(), backlink].filter(Boolean).join('\n\n'),
			});
		}
		return ctx.runMutation(internal.relayFeedback.save, {
			feedbackId: input.feedbackId,
			connectionId: c.connection.id,
			target: issue,
		});
	},
});
export const refreshCounts = action({
	args: { feedbackId: v.id('feedback') },
	returns: v.object({ updatedCount: v.number() }),
	handler: async (ctx, input) => {
		const c = await ctx.runQuery(internal.relayFeedback.context, input);
		await limits.limit(ctx, 'relayIssue', { key: c.profileId, throws: true });
		const token = await tokenWithRecovery(ctx, c.installation, 'read', [c.connection.repoId]);
		const links = await ctx.runQuery(api.relayFeedback.listByFeedback, input);
		let updatedCount = 0;
		for (const link of links) {
			if (link.githubRepositoryConnectionId !== c.connection.id) continue;
			const issue = await getRepositoryIssue({
				repository: repo(c.connection),
				token: token.token,
				issueNumber: link.githubNumber,
			});
			await ctx.runMutation(internal.relayFeedback.save, {
				...input,
				connectionId: c.connection.id,
				target: issue,
				refresh: true,
			});
			updatedCount++;
		}
		return { updatedCount };
	},
});
