import { describe, expect, it } from 'vitest';

import { accountTable } from '../../convex/functions/schema';

	describe('account auth schema', () => {
		it('defines the Better Auth compound identity index in issuer/accountId order', () => {
			const indexes = (
				accountTable as unknown as { export(): { indexes: Array<unknown> } }
			).export().indexes;
			expect(indexes).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
					fields: ['issuer', 'accountId'],
					indexDescriptor: 'issuer_accountId',
				}),
			])
		);
	});
});
