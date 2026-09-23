// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, expect, test, vi } from 'vitest';

import schema from '../email/convex/schema';

const send = vi.hoisted(() => vi.fn());
vi.mock('../../../convex/lib/bento', () => ({ sendEmail: send }));
const modules = import.meta.glob('../email/convex/**/*.ts');
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	send.mockReset();
});
async function setup() {
	vi.stubEnv('PROOF_EMAIL', 'hello@natedunn.net');
	const t = convexTest(schema, modules);
	const data = await t.run(async (ctx) => {
		const userId = await ctx.db.insert('users', {
			email: 'owner@example.test',
			verified: true,
			verificationGeneration: 0,
			resetGeneration: 0,
		});
		const organizationId = await ctx.db.insert('organizations', {
			name: 'Mail proof',
			slug: 'mail',
		});
		await ctx.db.insert('memberships', { organizationId, userId, role: 'owner' });
		return { userId, organizationId };
	});
	return { t, ...data, owner: t.withIdentity({ subject: data.userId }) };
}
test('real adapter creates invitation and schedules fixed-origin, localized Bento mail', async () => {
	vi.useFakeTimers();
	const s = await setup();
	send.mockResolvedValue(1);
	const invitationId = await s.owner.mutation(
		makeFunctionReference<'mutation'>('invitations:create'),
		{ organizationId: s.organizationId, email: 'hello@natedunn.net', role: 'admin', projectIds: [] }
	);
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(send).toHaveBeenCalled();
	const message = send.mock.calls[0][0];
	expect(message.to).toBe('hello@natedunn.net');
	expect(message.html).toContain(
		`http://127.0.0.1:5181/auth/accept-invitation?invitationId=${invitationId}`
	);
	expect(message.html).toContain('Mail proof');
	expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({
		deliveryStatus: 'accepted',
	});
});
test('delivery rejects unintended recipients and creation does not allow browser-supplied origin', async () => {
	const s = await setup();
	for (const args of [
		{
			organizationId: s.organizationId,
			email: 'other@example.test',
			role: 'admin',
			projectIds: [],
		},
		{
			organizationId: s.organizationId,
			email: 'hello@natedunn.net',
			role: 'admin',
			projectIds: [],
			origin: 'https://evil.example',
		},
	])
		await expect(
			s.owner.mutation(makeFunctionReference<'mutation'>('invitations:create'), args)
		).rejects.toThrow();
	expect(send).not.toHaveBeenCalled();
	expect(await s.t.run((ctx) => ctx.db.query('invitations').collect())).toHaveLength(0);
});

test('cancelled invitation is skipped by scheduled delivery', async () => {
	vi.useFakeTimers();
	const s = await setup();
	send.mockResolvedValue(1);
	const invitationId = await s.owner.mutation(
		makeFunctionReference<'mutation'>('invitations:create'),
		{ organizationId: s.organizationId, email: 'hello@natedunn.net', role: 'admin', projectIds: [] }
	);
	await s.owner.mutation(makeFunctionReference<'mutation'>('invitations:cancel'), { invitationId });
	await s.t.finishAllScheduledFunctions(vi.runAllTimers);
	expect(send).not.toHaveBeenCalled();
});
test('Bento failure records failed delivery without claiming acceptance', async () => {
	const s = await setup();
	send.mockRejectedValue(new Error('Bento refused'));
	const invitationId = await s.t.run((ctx) =>
		ctx.db.insert('invitations', {
			organizationId: s.organizationId,
			inviterId: s.userId,
			email: 'hello@natedunn.net',
			role: 'admin',
			projectIds: [],
			status: 'pending',
			expiresAt: Date.now() + 60000,
		})
	);
	await expect(
		s.t.action(makeFunctionReference<'action'>('invitationMail:deliver'), { invitationId })
	).rejects.toThrow('Invitation delivery failed');
	expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({
		deliveryStatus: 'failed',
		status: 'pending',
	});
});
