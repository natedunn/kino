import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { action } from './_generated/server';
import {
	createInstallationToken,
	isGitHubNotFoundError,
	listInstallationRepositories,
	probeRepository,
	sanitizeGitHubRepository,
} from './relayClient';
import { mode, source } from './relaySchema';

export async function tokenWithRecovery(
	ctx: ActionCtx,
	installation: { id: Id<'relayInstallations'>; installationId: number },
	access: 'read' | 'read_write',
	repositoryIds?: Array<number>
) {
	try {
		return await createInstallationToken({
			installationId: installation.installationId,
			mode: access,
			repositoryIds,
		});
	} catch (error) {
		if (!isGitHubNotFoundError(error)) throw error;
		await ctx.runMutation(internal.relay.stale, { id: installation.id });
		throw new ConvexError('GITHUB_INSTALLATION_STALE');
	}
}
export const listInstallationRepositoriesForProject = action({
	args: { orgSlug: v.string(), installationId: v.number() },
	returns: v.array(
		v.object({
			id: v.number(),
			nodeId: v.string(),
			name: v.string(),
			fullName: v.string(),
			owner: v.string(),
			private: v.boolean(),
		})
	),
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.relay.reserveAction, { orgSlug: args.orgSlug });
		const installation = await ctx.runQuery(internal.relay.installationContext, args);
		const token = await tokenWithRecovery(ctx, installation, 'read');
		const repos = await listInstallationRepositories(token.token);
		await ctx.runQuery(internal.relay.installationContext, args);
		return repos.map((r) => ({
			id: r.id,
			nodeId: r.node_id,
			name: r.name,
			fullName: r.full_name,
			owner: r.owner.login,
			private: r.private,
		}));
	},
});
export const connectRepository = action({
	args: {
		orgSlug: v.string(),
		projectSlug: v.string(),
		installationId: v.number(),
		repoId: v.number(),
		mode,
		enabledSources: v.array(source),
	},
	returns: v.object({ connectionId: v.id('relayConnections') }),
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.relay.reserveAction, {
			orgSlug: args.orgSlug,
			projectSlug: args.projectSlug,
		});
		const installation = await ctx.runQuery(internal.relay.installationContext, {
			orgSlug: args.orgSlug,
			projectSlug: args.projectSlug,
			installationId: args.installationId,
		});
		const token = await tokenWithRecovery(ctx, installation, args.mode, [args.repoId]);
		const repos = await listInstallationRepositories(token.token),
			repository = repos.find((r) => r.id === args.repoId);
		if (!repository)
			throw new ConvexError('GitHub repository is not available to this installation');
		const probe = await probeRepository({ repository, token: token.token, mode: args.mode });
		if (args.enabledSources.includes('discussions') && !probe.discussions.enabled)
			throw new ConvexError('GitHub Discussions are not enabled for this repository');
		return ctx.runMutation(internal.relay.saveRepository, {
			orgSlug: args.orgSlug,
			projectSlug: args.projectSlug,
			installationId: args.installationId,
			installationRowId: installation.id,
			repository: sanitizeGitHubRepository(repository),
			mode: args.mode,
			enabledSources: args.enabledSources,
			verificationSummary: { issues: probe.issues, discussions: probe.discussions },
		});
	},
});
