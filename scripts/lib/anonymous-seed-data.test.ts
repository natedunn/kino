import { describe, expect, it } from 'vitest';

import {
	backfillAccountIssuerContents,
	backfillAccountIssuerContentsWithStats,
	backfillAccountIssuerLine,
} from './anonymous-seed-data.mjs';

describe('anonymous Better Auth account seeding', () => {
	it('adds the GitHub issuer without changing Convex float encodings', () => {
		const line =
			'{"_id":"account-1","accountId":"123","providerId":"github","userId":"user-1","scope":"","accessTokenExpiresAt":0.0}';

		expect(backfillAccountIssuerLine(line)).toBe(
			'{"_id":"account-1","accountId":"123","providerId":"github","userId":"user-1","scope":"","accessTokenExpiresAt":0.0,"issuer":"local:oauth:github"}'
		);
	});

	it('preserves an already-migrated issuer idempotently', () => {
		const line =
			'{"_id":"account-1","accountId":"123","providerId":"github","userId":"user-1","issuer":"local:oauth:github"}';
		expect(backfillAccountIssuerLine(line)).toBe(line);
	});

	it('maps credential accounts only when their account ID is the linked user ID', () => {
		expect(
			backfillAccountIssuerLine(
				'{"_id":"account-1","accountId":"user-1","providerId":"credential","userId":"user-1"}'
			)
		).toContain('"issuer":"local:credential"');
		expect(() =>
			backfillAccountIssuerLine(
				'{"_id":"account-1","accountId":"legacy","providerId":"credential","userId":"user-1"}'
			)
		).toThrow(/does not use its linked user ID/);
	});

	it('rejects unknown providers instead of guessing an identity', () => {
		expect(() =>
			backfillAccountIssuerLine(
				'{"_id":"account-1","accountId":"123","providerId":"custom","userId":"user-1"}'
			)
		).toThrow(/map issuer/);
	});

	it('keeps JSONL framing stable', () => {
		const contents =
			'{"accountId":"1","providerId":"github","userId":"u1"}\n{"accountId":"2","providerId":"github","userId":"u2"}\n';
		expect(backfillAccountIssuerContents(contents).split('\n')).toHaveLength(3);
	});

	it('counts only rows that receive an issuer', () => {
		const contents =
			'{"accountId":"1","providerId":"github","userId":"u1"}\n' +
			'{"accountId":"2","providerId":"github","userId":"u2","issuer":"local:oauth:github"}\n';

		const result = backfillAccountIssuerContentsWithStats(contents);

		expect(result.changedRows).toBe(1);
		expect(result.contents).toContain(
			'{"accountId":"1","providerId":"github","userId":"u1","issuer":"local:oauth:github"}'
		);
		expect(result.contents).toContain(
			'{"accountId":"2","providerId":"github","userId":"u2","issuer":"local:oauth:github"}'
		);
	});
});
