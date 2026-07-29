import { describe, expect, it, vi } from 'vitest';

import { GITHUB_INSTALLATION_STALE_REASON, recoverFromInstallationTokenError } from './github.lib';

describe('GitHub installation token recovery', () => {
	it('marks a missing installation stale and returns a stable conflict error', async () => {
		const markInstallationStale = vi.fn().mockResolvedValue({ updatedCount: 1 });

		const error = await recoverFromInstallationTokenError({
			caller: { markInstallationStale },
			error: Object.assign(new Error('GitHub request failed (404): Not Found'), {
				code: 'NOT_FOUND',
			}),
			installationId: 123,
		}).catch((caught: unknown) => caught);

		expect(markInstallationStale).toHaveBeenCalledWith({ installationId: 123 });
		expect(error).toMatchObject({
			code: 'CONFLICT',
			data: { reason: GITHUB_INSTALLATION_STALE_REASON },
		});
		expect((error as Error).message).toMatch(/needs to be refreshed/i);
	});

	it('preserves non-404 failures without changing installation state', async () => {
		const markInstallationStale = vi.fn();
		const original = Object.assign(new Error('GitHub request failed (422)'), {
			code: 'BAD_REQUEST',
		});

		const error = await recoverFromInstallationTokenError({
			caller: { markInstallationStale },
			error: original,
			installationId: 123,
		}).catch((caught: unknown) => caught);

		expect(error).toBe(original);
		expect(markInstallationStale).not.toHaveBeenCalled();
	});
});
