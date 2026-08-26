import { defineMigration } from '../generated/migrations.gen';

const issuerByProviderId = {
	credential: 'local:credential',
	github: 'local:oauth:github',
} as const;

export const migration = defineMigration({
	id: '20260825_000000_backfill_account_issuer',
	description: 'Backfill Better Auth 1.7 account identity issuers',
	up: {
		table: 'account',
		migrateOne: async (ctx, account) => {
			const issuer = issuerByProviderId[account.providerId as keyof typeof issuerByProviderId];
			if (!issuer) {
				throw new Error(`Map issuer for Better Auth provider ${account.providerId}`);
			}

			const accountId = account.providerId === 'credential' ? account.userId : account.accountId;
			if (account.issuer !== undefined && account.issuer !== issuer) {
				throw new Error(`Issuer mismatch for account ${account._id}`);
			}
			if (account.issuer === issuer && account.accountId === accountId) return;

			const accountsWithId = await ctx.db
				.query('account')
				.withIndex('accountId', (query) => query.eq('accountId', accountId))
				.collect();
			const collision = accountsWithId.find((candidate) => candidate.issuer === issuer);
			if (collision && collision._id !== account._id) {
				throw new Error(`Duplicate Better Auth account identity ${issuer}:${accountId}`);
			}

			return { accountId, issuer };
		},
	},
});
