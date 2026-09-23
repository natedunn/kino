import type { GenericId } from 'convex/values';
import type { UserCallbacks } from '../../.revocation/packages/core/src/lib/types';
import type { MutationCtx } from './_generated/server';

import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { setupCore } from '../../.revocation/packages/core/src/components/core/setup.ts';
import { sha256Hex } from '../../.revocation/packages/core/src/lib/crypto.ts';
import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';

const callbacks: UserCallbacks<'emailPassword', { email: string }, 'users'> = {
	createUser: internal.auth.createUser,
	onSignIn: internal.auth.onSignIn,
};

// Local proof only; uses the proposed session-revocation patch.
const core = setupCore({ component: components.auth });
export const { refreshSession, signOut } = core;
const { authMutation } = core.bindProvider({ name: 'emailPassword', ...callbacks });
const limits = new RateLimiter(components.emailLimits, {
	email: { kind: 'token bucket', rate: 3, period: MINUTE, capacity: 3 },
	login: { kind: 'token bucket', rate: 5, period: MINUTE, capacity: 5 },
});
const provider = v.object({
	name: v.literal('emailPassword'),
	accountId: v.string(),
	profile: v.object({ email: v.string() }),
});
const accepted = { status: 'accepted' as const };
const failure = (error: string) => ({ status: 'error' as const, userError: { error } });
function normalize(email: string) {
	const result = email.trim().toLowerCase();
	if (result !== process.env.PROOF_EMAIL) throw new ConvexError('PROOF_RECIPIENT_ONLY');
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new ConvexError('INVALID_EMAIL');
	return result;
}
const findUser = (ctx: MutationCtx, email: string) =>
	ctx.db
		.query('users')
		.withIndex('by_email', (q) => q.eq('email', email))
		.unique();

export const createUser = internalMutation({
	args: { provider },
	returns: v.id('users'),
	handler: async (ctx, { provider }) => {
		if (await findUser(ctx, provider.profile.email)) throw new ConvexError('DUPLICATE_EMAIL');
		return ctx.db.insert('users', {
			email: provider.profile.email,
			verified: false,
			verificationGeneration: 0,
			resetGeneration: 0,
		});
	},
});
export const onSignIn = internalMutation({
	args: { provider, userId: v.id('users') },
	returns: v.null(),
	handler: async (ctx, { userId }) => {
		const user = await ctx.db.get(userId);
		if (!user?.verified) throw new ConvexError('SIGN_IN_REJECTED');
		return null;
	},
});

async function issue(ctx: MutationCtx, userId: GenericId<'users'>, purpose: 'verify' | 'reset') {
	const user = await ctx.db.get(userId);
	if (!user?.email) throw new Error('Missing password user');
	const field = purpose === 'verify' ? 'verificationGeneration' : 'resetGeneration';
	const generation = user[field] + 1;
	const code = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
		b.toString(16).padStart(2, '0')
	).join('');
	await ctx.db.patch(userId, { [field]: generation });
	await ctx.db.insert('challenges', {
		userId,
		purpose,
		generation,
		hash: await sha256Hex(code),
		expiresAt: Date.now() + 15 * MINUTE,
	});
	await ctx.scheduler.runAfter(0, makeFunctionReference<'action'>('mail:deliver'), {
		email: user.email,
		purpose,
		code,
	});
}
async function challenge(ctx: MutationCtx, code: string, purpose: 'verify' | 'reset') {
	const hash = await sha256Hex(code);
	const proof = await ctx.db
		.query('challenges')
		.withIndex('by_hash', (q) => q.eq('hash', hash))
		.unique();
	if (!proof || proof.purpose !== purpose || proof.expiresAt <= Date.now())
		throw new ConvexError('INVALID_PROOF');
	const user = await ctx.db.get(proof.userId);
	const generation = purpose === 'verify' ? user?.verificationGeneration : user?.resetGeneration;
	if (!user?.email || proof.generation !== generation || (purpose === 'verify' && user.verified))
		throw new ConvexError('INVALID_PROOF');
	return { proof, user };
}

export const signUp = authMutation({
	args: { email: v.string(), password: v.string() },
	handler: async (ctx, { email: raw, password }) => {
		const app = ctx as MutationCtx;
		const email = normalize(raw);
		const limit = await limits.limit(ctx, 'email', { key: email });
		if (!limit.ok) return failure('RATE_LIMITED');
		// Repeated signup never replaces an existing credential or verified status.
		if (await findUser(app, email)) return accepted;
		const { userId } = await ctx.convexAuth.signUpWithoutSession({
			providerAccountId: email,
			profile: { email },
		});
		const result = await ctx.runMutation(components.password.public.setPassword, {
			userId,
			password,
		});
		if (!result.success) throw new ConvexError(result.userError.error);
		await issue(app, userId as GenericId<'users'>, 'verify');
		return accepted;
	},
});

export const requestEmail = authMutation({
	args: { email: v.string(), purpose: v.union(v.literal('verify'), v.literal('reset')) },
	handler: async (ctx, { email: raw, purpose }) => {
		const email = normalize(raw);
		const limit = await limits.limit(ctx, 'email', { key: email });
		if (!limit.ok) return failure('RATE_LIMITED');
		const user = await findUser(ctx as MutationCtx, email);
		if (user && (purpose === 'reset' ? user.verified : !user.verified))
			await issue(ctx as MutationCtx, user._id, purpose);
		return accepted;
	},
});

export const verifyEmail = authMutation({
	args: { code: v.string() },
	handler: async (ctx, { code }) => {
		const app = ctx as MutationCtx;
		const { proof, user } = await challenge(app, code, 'verify');
		if (!user.email) throw new ConvexError('INVALID_PROOF');
		await app.db.patch(user._id, { verified: true });
		await app.db.delete(proof._id);
		// Failed core callbacks roll proof consumption and verified status back.
		const tokens = await ctx.convexAuth.completeSignIn({
			providerAccountId: user.email,
			profile: { email: user.email },
		});
		return { status: 'complete' as const, tokens };
	},
});
export const signIn = authMutation({
	args: { email: v.string(), password: v.string() },
	handler: async (ctx, { email: raw, password }) => {
		const email = normalize(raw);
		const limit = await limits.limit(ctx, 'login', { key: email });
		if (!limit.ok) return failure('RATE_LIMITED');
		const user = await findUser(ctx as MutationCtx, email);
		if (!user?.verified) return failure('INVALID_CREDENTIALS');
		const result = await ctx.runMutation(components.password.public.verifyPassword, {
			userId: user._id,
			password,
		});
		if (!result.success) return failure('INVALID_CREDENTIALS');
		return {
			status: 'complete' as const,
			tokens: await ctx.convexAuth.completeSignIn({ providerAccountId: email, profile: { email } }),
		};
	},
});
export const resetPassword = authMutation({
	args: { code: v.string(), password: v.string() },
	handler: async (ctx, args) => completeReset(ctx as MutationCtx, args, true),
});

// Used only with the separate patched core fixture. No public userId argument:
// authority to revoke comes from the same consumed recovery proof.
export const resetPasswordWithRevocation = authMutation({
	args: { code: v.string(), password: v.string() },
	handler: async (ctx, args) => completeReset(ctx as MutationCtx, args, true),
});

async function completeReset(
	app: MutationCtx,
	{ code, password }: { code: string; password: string },
	revoke: boolean
) {
	const { proof, user } = await challenge(app, code, 'reset');
	if (!user.verified) throw new ConvexError('INVALID_PROOF');
	const result = await app.runMutation(components.password.public.setPassword, {
		userId: user._id,
		password,
	});
	if (!result.success) throw new ConvexError(result.userError.error);
	await app.db.delete(proof._id);
	if (revoke)
		await app.runMutation(components.auth.public.revokeUserSessions, { userId: user._id });
	// The baseline path retains the original gap for comparison with the patch.
	return { status: 'passwordUpdated' as const };
}
