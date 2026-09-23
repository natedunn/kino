import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

import { sha256Hex } from '@convex-dev/auth/lib/crypto';
import { vSignInComplete } from '@convex-dev/auth/lib/types';
import { validateNewPassword } from '@convex-dev/auth/providers/password/validation';
import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { core } from './auth';
import { emailCredentials } from './mailConfig';
import { ensurePersonalOrganization } from './organizations';
import { ensureProfile } from './profiles';
import { challengePurpose, localeValidator } from './schema';

const providerValidator = v.object({
	name: v.literal('emailPassword'),
	accountId: v.string(),
	profile: v.object({
		email: v.string(),
		name: v.optional(v.string()),
		locale: v.optional(localeValidator),
	}),
});
const { authMutation } = core.bindProvider({
	name: 'emailPassword',
	createUser: internal.password.createUser,
	onSignIn: internal.password.onSignIn,
});
const limits = new RateLimiter(components.authLimits, {
	email: { kind: 'token bucket', rate: 3, period: MINUTE, capacity: 3 },
	login: { kind: 'token bucket', rate: 5, period: MINUTE, capacity: 5 },
});
const accepted = { status: 'accepted' as const };
const failure = (error: string) => ({ status: 'error' as const, userError: { error } });
const errorResult = v.object({
	status: v.literal('error'),
	userError: v.object({ error: v.string() }),
});
const acceptedResult = v.union(v.object({ status: v.literal('accepted') }), errorResult);
function normalize(email: string) {
	const result = email.trim().toLowerCase();
	if (result.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
		throw new ConvexError('INVALID_EMAIL');
	return result;
}
const findUser = (ctx: MutationCtx, email: string) =>
	ctx.db
		.query('users')
		.withIndex('by_passwordEmail', (q) => q.eq('passwordEmail', email))
		.unique();

export const createUser = internalMutation({
	args: { provider: providerValidator },
	returns: v.id('users'),
	handler: async (ctx, { provider }) => {
		const email = normalize(provider.profile.email);
		if (provider.accountId !== email) throw new ConvexError('PASSWORD_ACCOUNT_MISMATCH');
		if (await findUser(ctx, email)) throw new ConvexError('DUPLICATE_EMAIL');
		return ctx.db.insert('users', {
			status: 'pendingVerification',
			systemRole: 'user',
			passwordEmail: email,
			registrationName: provider.profile.name?.trim().slice(0, 200) || email.split('@')[0],
			registrationLocale: provider.profile.locale ?? 'en-US',
		});
	},
});
export const onSignIn = internalMutation({
	args: { provider: providerValidator, userId: v.id('users') },
	returns: v.null(),
	handler: async (ctx, { provider, userId }) => {
		const user = await ctx.db.get('users', userId);
		if (
			!user ||
			user.status !== 'active' ||
			user.passwordEmailVerifiedAt === undefined ||
			user.passwordEmail !== provider.accountId ||
			user.passwordEmail !== provider.profile.email
		)
			throw new ConvexError('SIGN_IN_REJECTED');
		const profileId = await ensureProfile(ctx, userId, {
			name: user.registrationName || user.passwordEmail.split('@')[0],
			username: user.passwordEmail.split('@')[0],
		});
		if (user.registrationLocale)
			await ctx.db.patch('profiles', profileId, { locale: user.registrationLocale });
		await ensurePersonalOrganization(ctx, userId);
		await ctx.db.patch('users', userId, {
			registrationName: undefined,
			registrationLocale: undefined,
		});
		return null;
	},
});
async function issue(ctx: MutationCtx, userId: Id<'users'>, purpose: 'verify' | 'reset') {
	const code = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
		b.toString(16).padStart(2, '0')
	).join('');
	const values = { hash: await sha256Hex(code), expiresAt: Date.now() + 15 * MINUTE };
	const previous = await ctx.db
		.query('authChallenges')
		.withIndex('by_userId_and_purpose', (q) => q.eq('userId', userId).eq('purpose', purpose))
		.unique();
	let challengeId: Id<'authChallenges'>;
	if (previous) {
		await ctx.db.patch('authChallenges', previous._id, values);
		challengeId = previous._id;
	} else challengeId = await ctx.db.insert('authChallenges', { userId, purpose, ...values });
	await ctx.scheduler.runAfter(0, internal.mail.deliver, { challengeId, code, attempt: 0 });
}
async function challenge(ctx: MutationCtx, code: string, purpose: 'verify' | 'reset') {
	if (!/^[a-f0-9]{64}$/.test(code)) throw new ConvexError('INVALID_PROOF');
	const hash = await sha256Hex(code);
	const proof = await ctx.db
		.query('authChallenges')
		.withIndex('by_hash', (q) => q.eq('hash', hash))
		.unique();
	if (!proof || proof.purpose !== purpose || proof.expiresAt <= Date.now())
		throw new ConvexError('INVALID_PROOF');
	const user = await ctx.db.get('users', proof.userId);
	if (
		!user?.passwordEmail ||
		(purpose === 'verify'
			? user.status !== 'pendingVerification' || user.passwordEmailVerifiedAt !== undefined
			: user.status !== 'active' || user.passwordEmailVerifiedAt === undefined)
	)
		throw new ConvexError('INVALID_PROOF');
	return { proof, user };
}
export const signUp = authMutation({
	args: {
		email: v.string(),
		password: v.string(),
		name: v.string(),
		locale: v.optional(localeValidator),
	},
	returns: acceptedResult,
	handler: async (ctx, { email: raw, password, name, locale }) => {
		const app = ctx as MutationCtx;
		const email = normalize(raw);
		if (!emailCredentials()) return failure('EMAIL_UNAVAILABLE');
		if (!(await limits.limit(ctx, 'email', { key: email })).ok) return failure('RATE_LIMITED');
		const invalid = validateNewPassword(password);
		if (invalid) return failure(invalid.error);
		if (!name.trim() || name.trim().length > 200) return failure('INVALID_NAME');
		// Never overwrite an existing credential or automatically link OAuth accounts.
		if (await findUser(app, email)) return accepted;
		const { userId } = await ctx.convexAuth.signUpWithoutSession({
			providerAccountId: email,
			profile: { email, name: name.trim(), locale: locale ?? 'en-US' },
		});
		const result = await ctx.runMutation(components.password.public.setPassword, {
			userId,
			password,
		});
		if (!result.success) throw new ConvexError(result.userError.error);
		const id = app.db.normalizeId('users', userId);
		if (!id) throw new Error('Invalid native user id');
		await issue(app, id, 'verify');
		return accepted;
	},
});
export const requestEmail = authMutation({
	args: { email: v.string(), purpose: challengePurpose },
	returns: acceptedResult,
	handler: async (ctx, { email: raw, purpose }) => {
		const email = normalize(raw);
		if (!emailCredentials()) return failure('EMAIL_UNAVAILABLE');
		if (!(await limits.limit(ctx, 'email', { key: email })).ok) return failure('RATE_LIMITED');
		const app = ctx as MutationCtx;
		const user = await findUser(app, email);
		if (
			user &&
			(purpose === 'verify'
				? user.status === 'pendingVerification' && user.passwordEmailVerifiedAt === undefined
				: user.status === 'active' && user.passwordEmailVerifiedAt !== undefined)
		)
			await issue(app, user._id, purpose);
		return accepted;
	},
});
export const verifyEmail = authMutation({
	args: { code: v.string() },
	returns: vSignInComplete,
	handler: async (ctx, { code }) => {
		const app = ctx as MutationCtx;
		const { proof, user } = await challenge(app, code, 'verify');
		await app.db.patch('users', user._id, {
			status: 'active',
			passwordEmailVerifiedAt: Date.now(),
		});
		await app.db.delete('authChallenges', proof._id);
		// Core callback, profile/org bootstrap and proof redemption share a transaction.
		return {
			status: 'complete' as const,
			tokens: await ctx.convexAuth.completeSignIn({
				providerAccountId: user.passwordEmail!,
				profile: { email: user.passwordEmail! },
			}),
		};
	},
});
export const signIn = authMutation({
	args: { email: v.string(), password: v.string() },
	returns: v.union(vSignInComplete, errorResult),
	handler: async (ctx, { email: raw, password }) => {
		const email = normalize(raw);
		if (!(await limits.limit(ctx, 'login', { key: email })).ok) return failure('RATE_LIMITED');
		const user = await findUser(ctx, email);
		if (!user || user.status !== 'active' || user.passwordEmailVerifiedAt === undefined)
			return failure('INVALID_CREDENTIALS');
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
	returns: v.union(v.object({ status: v.literal('passwordUpdated') }), errorResult),
	handler: async (ctx, { code, password }) => {
		const app = ctx as MutationCtx;
		const { proof, user } = await challenge(app, code, 'reset');
		const invalid = validateNewPassword(password);
		if (invalid) return failure(invalid.error);
		const result = await ctx.runMutation(components.password.public.setPassword, {
			userId: user._id,
			password,
		});
		if (!result.success) throw new ConvexError(result.userError.error);
		await app.db.delete('authChallenges', proof._id);
		await ctx.runMutation(components.auth.public.revokeUserSessions, { userId: user._id });
		return { status: 'passwordUpdated' as const };
	},
});
export const clearExpiredChallenges = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const expired = await ctx.db
			.query('authChallenges')
			.withIndex('by_expiresAt', (q) => q.lte('expiresAt', Date.now()))
			.take(100);
		for (const row of expired) await ctx.db.delete('authChallenges', row._id);
		return expired.length;
	},
});
