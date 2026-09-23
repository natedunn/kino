import { DurableObject } from 'cloudflare:workers';

// One object per unpredictable login reference. No shared global bottleneck.
export class OAuthState extends DurableObject {
	async create(envelope: string) {
		return this.ctx.storage.transaction(async (tx) => {
			if (await tx.get('record')) return false;
			const expiresAt = Date.now() + 600_000;
			await tx.put('record', { envelope, expiresAt });
			await tx.setAlarm(expiresAt);
			return true;
		});
	}
	async consume(): Promise<string | null> {
		return this.ctx.storage.transaction(async (tx) => {
			const record = await tx.get<{ envelope: string; expiresAt: number }>('record');
			await tx.delete('record');
			return record && record.expiresAt > Date.now() ? record.envelope : null;
		});
	}
	async alarm() {
		await this.ctx.storage.deleteAll();
	}
}
