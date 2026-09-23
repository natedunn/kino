import { v } from 'convex/values';

import { internal } from './_generated/api';
import { action } from './_generated/server';
import { tokenWithRecovery } from './relayActions';
import { fetchRepository } from './relayClient';

export const importGithubUrls = action({
	args: { id: v.id('projects') },
	returns: v.object({ homepage: v.union(v.null(), v.string()), repoUrl: v.string() }),
	handler: async (ctx, args) => {
		const c = await ctx.runQuery(internal.settings.githubImportContext, args);
		const token = await tokenWithRecovery(ctx, c.installation, 'read', [c.connection.repoId]);
		const repo = await fetchRepository({ fullName: c.connection.repoFullName, token: token.token });
		await ctx.runQuery(internal.settings.githubImportContext, args);
		const homepage = repo.homepage?.trim();
		return {
			homepage: homepage && /^https?:\/\//i.test(homepage) ? homepage : null,
			repoUrl: repo.htmlUrl,
		};
	},
});
