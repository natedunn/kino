// @vitest-environment edge-runtime
import type { Id } from '../organizations/convex/_generated/dataModel';

import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';

import schema from '../organizations/convex/schema';

const modules = import.meta.glob('../organizations/convex/**/*.{ts,js}');
const fn = (name: string) => makeFunctionReference<'mutation'>(name);
async function setup() {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) =>
		Promise.all(
			['owner', 'recipient', 'outsider', 'unverified'].map((name) =>
				ctx.db.insert('users', {
					email: `${name === 'unverified' ? 'recipient' : name}@example.test`,
					verified: name !== 'unverified',
				})
			)
		)
	);
	const [owner, recipient, outsider, unverified] = ids.map((subject) =>
		t.withIdentity({ subject })
	);
	const org = await owner.mutation(fn('organizations:create'), { name: 'Acme', slug: 'acme' });
	const foreignOrg = await outsider.mutation(fn('organizations:create'), {
		name: 'Other',
		slug: 'other',
	});
	const project = await owner.mutation(fn('organizations:createProject'), {
		organizationId: org,
		name: 'Project',
	});
	const foreign: Id<'projects'> = await outsider.mutation(fn('organizations:createProject'), {
		organizationId: foreignOrg,
		name: 'Foreign',
	});
	const input = {
		organizationId: org,
		email: ' Recipient@Example.Test ',
		role: 'moderator',
		projectIds: [project],
	};
	const invite = (): Promise<Id<'invitations'>> => owner.mutation(fn('invitations:create'), input);
	return { t, ids, owner, recipient, outsider, unverified, org, project, foreign, input, invite };
}
test('verified recipient accepts normalized email and gets assigned project access atomically', async () => {
	const s = await setup();
	const invitationId = await s.invite();
	const membershipId = await s.recipient.mutation(fn('invitations:accept'), { invitationId });
	await s.recipient.mutation(fn('organizations:increment'), { projectId: s.project });
	expect(await s.t.run((ctx) => ctx.db.get(membershipId))).toMatchObject({
		userId: s.ids[1],
		role: 'moderator',
		organizationId: s.org,
	});
	expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({
		email: 'recipient@example.test',
		status: 'accepted',
		projectIds: [],
		acceptedBy: s.ids[1],
	});
	expect(await s.recipient.mutation(fn('invitations:accept'), { invitationId })).toBe(membershipId);
	expect(await s.t.run((ctx) => ctx.db.query('assignments').collect())).toHaveLength(1);
});
test('anonymous, wrong-account and unverified recipients cannot accept or reject; supplied email rejected', async () => {
	const s = await setup();
	const invitationId = await s.invite();
	for (const client of [s.t, s.outsider, s.unverified])
		for (const name of ['accept', 'reject']) {
			await expect(client.mutation(fn(`invitations:${name}`), { invitationId })).rejects.toThrow();
		}
	await expect(
		s.outsider.mutation(fn('invitations:accept'), { invitationId, email: 'recipient@example.test' })
	).rejects.toThrow();
	expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({ status: 'pending' });
});
test('only organization managers issue/cancel; owner role and foreign assignments refused', async () => {
	const s = await setup();
	for (const client of [s.t, s.outsider, s.unverified])
		await expect(client.mutation(fn('invitations:create'), s.input)).rejects.toThrow();
	for (const input of [
		{ ...s.input, role: 'owner' },
		{ ...s.input, projectIds: [s.foreign] },
		{ ...s.input, projectIds: [] },
		{ ...s.input, email: 'invalid' },
	])
		await expect(s.owner.mutation(fn('invitations:create'), input)).rejects.toThrow();
	const invitationId = await s.invite();
	await expect(s.outsider.mutation(fn('invitations:cancel'), { invitationId })).rejects.toThrow(
		'FORBIDDEN'
	);
	await s.recipient.mutation(fn('invitations:accept'), { invitationId });
	await expect(
		s.recipient.mutation(fn('invitations:create'), { ...s.input, email: 'new@example.test' })
	).rejects.toThrow('FORBIDDEN');
});
test('cancelled and rejected invitations cannot be accepted; fresh issue has different ID', async () => {
	for (const terminal of ['cancel', 'reject']) {
		const s = await setup();
		const invitationId = await s.invite();
		await (terminal === 'cancel' ? s.owner : s.recipient).mutation(fn(`invitations:${terminal}`), {
			invitationId,
		});
		await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
			'INVITATION_UNAVAILABLE'
		);
		expect((await s.t.run((ctx) => ctx.db.get(invitationId)))?.projectIds).toEqual([]);
		const next = await s.invite();
		expect(next).not.toBe(invitationId);
		await s.recipient.mutation(fn('invitations:accept'), { invitationId: next });
	}
});
test('duplicate pending invites rejected; expired invite fails and reissue leaves old ID unusable', async () => {
	const s = await setup();
	const invitationId = await s.invite();
	await expect(s.invite()).rejects.toThrow('INVITATION_PENDING');
	await s.t.run((ctx) => ctx.db.patch(invitationId, { expiresAt: 0 }));
	await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'INVITATION_UNAVAILABLE'
	);
	const next = await s.invite();
	expect(next).not.toBe(invitationId);
	expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({
		status: 'expired',
		projectIds: [],
	});
	await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'INVITATION_UNAVAILABLE'
	);
	await s.recipient.mutation(fn('invitations:accept'), { invitationId: next });
});
test('accepted invite replay cannot restore old role or recreate removed membership', async () => {
	const s = await setup();
	const invitationId = await s.invite();
	const membershipId = await s.recipient.mutation(fn('invitations:accept'), { invitationId });
	await s.owner.mutation(fn('organizations:setRole'), {
		membershipId,
		role: 'admin',
		projectIds: [],
	});
	await s.recipient.mutation(fn('invitations:accept'), { invitationId });
	expect(await s.t.run((ctx) => ctx.db.get(membershipId))).toMatchObject({ role: 'admin' });
	await s.owner.mutation(fn('organizations:remove'), { membershipId });
	await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'INVITATION_UNAVAILABLE'
	);
	const next = await s.invite();
	const newMembership = await s.recipient.mutation(fn('invitations:accept'), {
		invitationId: next,
	});
	expect(newMembership).not.toBe(membershipId);
	await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'INVITATION_UNAVAILABLE'
	);
});
test('pending invitation never changes existing membership, including owner', async () => {
	const s = await setup();
	const invitationId = await s.owner.mutation(fn('invitations:create'), {
		...s.input,
		email: 'owner@example.test',
	});
	await expect(s.owner.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'ALREADY_MEMBER'
	);
	expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({ status: 'pending' });
});
test('acceptance revalidates deleted or moved projects without partial membership writes', async () => {
	for (const change of ['delete', 'move']) {
		const s = await setup();
		const invitationId = await s.invite();
		await s.t.run(async (ctx) => {
			if (change === 'delete') await ctx.db.delete(s.project);
			else
				await ctx.db.patch(s.project, {
					organizationId: (await ctx.db.get(s.foreign))!.organizationId,
				});
		});
		await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
			'INVALID_ASSIGNMENTS'
		);
		expect(
			await s.t.run((ctx) =>
				ctx.db
					.query('memberships')
					.withIndex('by_userId', (q) => q.eq('userId', s.ids[1]))
					.collect()
			)
		).toEqual([]);
		expect(await s.t.run((ctx) => ctx.db.get(invitationId))).toMatchObject({ status: 'pending' });
	}
});
test('deleted organization or revoked inviter authority makes invitation unusable', async () => {
	for (const change of ['organization', 'inviter']) {
		const s = await setup();
		const invitationId = await s.invite();
		await s.t.run(async (ctx) => {
			if (change === 'organization') await ctx.db.delete(s.org);
			else {
				const member = await ctx.db
					.query('memberships')
					.withIndex('by_organizationId_userId', (q) =>
						q.eq('organizationId', s.org).eq('userId', s.ids[0])
					)
					.unique();
				await ctx.db.patch(member!._id, { role: 'moderator' });
			}
		});
		await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
			'INVITATION_UNAVAILABLE'
		);
	}
});
test('admin invitation grants org management with no project assignments', async () => {
	const s = await setup();
	const invitationId = await s.owner.mutation(fn('invitations:create'), {
		...s.input,
		role: 'admin',
		projectIds: [],
	});
	await s.recipient.mutation(fn('invitations:accept'), { invitationId });
	await s.recipient.mutation(fn('organizations:createProject'), {
		organizationId: s.org,
		name: 'Allowed',
	});
	expect(await s.t.run((ctx) => ctx.db.query('assignments').collect())).toEqual([]);
});

test('OAuth email requires explicit provider verification; no implicit email account linking', async () => {
	const s = await setup();
	const invitationId = await s.invite();
	const oauthId = await s.t.run((ctx) =>
		ctx.db.insert('users', { verified: true, githubEmail: 'recipient@example.test' })
	);
	const oauth = s.t.withIdentity({ subject: oauthId });
	await expect(oauth.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'WRONG_RECIPIENT'
	);
	await s.t.run((ctx) => ctx.db.patch(oauthId, { githubEmailVerified: true }));
	const membershipId = await oauth.mutation(fn('invitations:accept'), { invitationId });
	expect(await s.t.run((ctx) => ctx.db.get(membershipId))).toMatchObject({ userId: oauthId });
	// Same verified mailbox on a different account cannot redeem the consumed invitation.
	await expect(s.recipient.mutation(fn('invitations:accept'), { invitationId })).rejects.toThrow(
		'INVITATION_UNAVAILABLE'
	);
});
