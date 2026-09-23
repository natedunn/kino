import { expect, test, vi } from 'vitest';

test('session-sync loads without random generation at Worker module scope', async () => {
	const random = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
		throw new Error('Disallowed operation called within global scope');
	});
	try {
		vi.resetModules();
		await expect(import('../start/src/session-sync')).resolves.toBeDefined();
		expect(random).not.toHaveBeenCalled();
	} finally {
		random.mockRestore();
	}
});
