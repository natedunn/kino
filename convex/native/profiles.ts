import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { httpUrlSchema, orgNameSchema, urlListSchema, usernameSchema } from '../shared/validation';
import { internalMutation, mutation, query } from './_generated/server';
import { getCurrentUser, requireCurrentUser } from './identity';
import { assertImageUploadUnclaimed, deleteUnclaimedImageUpload } from './imageUpload';
import { localeValidator } from './schema';

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_PENDING_AVATAR_UPLOADS = 10;
const UPLOAD_INTENT_TTL_MS = 10 * 60 * 1000;

const linkValidator = v.object({ text: v.string(), url: v.string() });
const organizationValidator = v.object({
	id: v.id('organizations'),
	name: v.string(),
	role: v.union(v.literal('owner'), v.literal('admin'), v.literal('moderator')),
	slug: v.string(),
	visibility: v.union(v.literal('public'), v.literal('private')),
});
const currentProfileValidator = v.object({
	id: v.id('users'),
	profileId: v.id('profiles'),
	name: v.string(),
	username: v.string(),
	bio: v.union(v.null(), v.string()),
	location: v.union(v.null(), v.string()),
	urls: v.array(linkValidator),
	imageUrl: v.union(v.null(), v.string()),
	email: v.string(),
	locale: v.optional(localeValidator),
	role: v.union(v.literal('user'), v.literal('system:admin')),
	systemRole: v.union(v.literal('user'), v.literal('system:admin')),
});
const publicProfileValidator = v.object({
	bio: v.union(v.null(), v.string()),
	id: v.id('profiles'),
	imageUrl: v.union(v.null(), v.string()),
	isViewerProfile: v.boolean(),
	location: v.union(v.null(), v.string()),
	name: v.string(),
	memberOrganizations: v.array(organizationValidator),
	ownedOrganizations: v.array(organizationValidator),
	urls: v.array(linkValidator),
	username: v.string(),
});

async function getOwnedProfile(ctx: QueryCtx | MutationCtx) {
	const user = await requireCurrentUser(ctx);
	if (!user.profileId) throw new ConvexError('PROFILE_NOT_FOUND');
	const profile = await ctx.db.get('profiles', user.profileId);
	if (!profile || profile.userId !== user._id) throw new ConvexError('PROFILE_NOT_FOUND');
	return { profile, user };
}

function verifiedEmail(user: {
	githubEmail?: string;
	githubEmailVerifiedAt?: number;
	passwordEmail?: string;
	passwordEmailVerifiedAt?: number;
}) {
	if (user.passwordEmail && user.passwordEmailVerifiedAt !== undefined) return user.passwordEmail;
	if (user.githubEmail && user.githubEmailVerifiedAt !== undefined) return user.githubEmail;
	return null;
}

async function resolveImageUrl(
	ctx: Pick<QueryCtx, 'storage'>,
	profile: { avatarStorageId?: Id<'_storage'>; imageUrl?: string }
) {
	if (profile.avatarStorageId) {
		const uploaded = await ctx.storage.getUrl(profile.avatarStorageId);
		if (uploaded) return uploaded;
	}
	return profile.imageUrl ?? null;
}

async function currentProfile(ctx: QueryCtx, user: Awaited<ReturnType<typeof getCurrentUser>>) {
	if (!user?.profileId) return null;
	const profile = await ctx.db.get('profiles', user.profileId);
	if (!profile || profile.userId !== user._id) return null;
	const email = verifiedEmail(user);
	if (!email) return null;
	return {
		id: user._id,
		profileId: profile._id,
		name: profile.name,
		username: profile.username,
		bio: profile.bio ?? null,
		location: profile.location ?? null,
		urls: profile.urls ?? [],
		imageUrl: await resolveImageUrl(ctx, profile),
		email,
		...(profile.locale ? { locale: profile.locale } : {}),
		role: user.systemRole,
		systemRole: user.systemRole,
	};
}

export async function ensureProfile(
	ctx: MutationCtx,
	userId: Id<'users'>,
	input: { name: string; username: string; imageUrl?: string }
) {
	const existing = await ctx.db
		.query('profiles')
		.withIndex('by_userId', (q) => q.eq('userId', userId))
		.unique();
	if (existing) {
		await ctx.db.patch('users', userId, { profileId: existing._id });
		return existing._id;
	}
	const base =
		input.username
			.toLowerCase()
			.replace(/[^a-z0-9_]/g, '')
			.slice(0, 30) || 'user';
	for (let attempt = 0; attempt < 10; attempt++) {
		const username = attempt === 0 ? base : `${base.slice(0, 30)}_${userId.slice(-6)}${attempt}`;
		const conflict = await ctx.db
			.query('profiles')
			.withIndex('by_username', (q) => q.eq('username', username))
			.unique();
		if (conflict) continue;
		const profileId = await ctx.db.insert('profiles', {
			userId,
			username,
			name: input.name.slice(0, 100),
			...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
		});
		await ctx.db.patch('users', userId, { profileId });
		return profileId;
	}
	throw new ConvexError('USERNAME_UNAVAILABLE');
}

export const me = query({
	args: {},
	returns: v.union(v.null(), currentProfileValidator),
	handler: async (ctx) => currentProfile(ctx, await getCurrentUser(ctx)),
});

export const getByUsername = query({
	args: { username: v.string() },
	returns: v.union(v.null(), publicProfileValidator),
	handler: async (ctx, args) => {
		const parsed = usernameSchema.safeParse(args.username);
		if (!parsed.success) return null;
		const profile = await ctx.db
			.query('profiles')
			.withIndex('by_username', (q) => q.eq('username', parsed.data))
			.unique();
		if (!profile) return null;
		const viewer = await getCurrentUser(ctx);
		const isViewerProfile = viewer?._id === profile.userId;
		const memberships = await ctx.db
			.query('memberships')
			.withIndex('by_userId', (q) => q.eq('userId', profile.userId))
			.take(100);
		const organizations = (
			await Promise.all(
				memberships.map(async (membership) => {
					const organization = await ctx.db.get('organizations', membership.organizationId);
					if (!organization || (!isViewerProfile && organization.visibility !== 'public'))
						return null;
					return {
						id: organization._id,
						name: organization.name,
						role: membership.role,
						slug: organization.slug,
						visibility: organization.visibility,
					};
				})
			)
		).filter((organization) => organization !== null);
		return {
			bio: profile.bio ?? null,
			id: profile._id,
			imageUrl: await resolveImageUrl(ctx, profile),
			isViewerProfile,
			location: profile.location ?? null,
			name: profile.name,
			memberOrganizations: organizations.filter(
				(organization) => organization.role !== 'owner' && organization.role !== 'admin'
			),
			ownedOrganizations: organizations.filter(
				(organization) => organization.role === 'owner' || organization.role === 'admin'
			),
			urls: profile.urls ?? [],
			username: profile.username,
		};
	},
});

export const update = mutation({
	args: {
		profile: v.object({
			bio: v.optional(v.union(v.null(), v.string())),
			imageKey: v.optional(v.union(v.null(), v.string())),
			location: v.optional(v.union(v.null(), v.string())),
			urls: v.optional(v.union(v.null(), v.array(linkValidator))),
		}),
		user: v.object({
			image: v.optional(v.union(v.null(), v.string())),
			name: v.optional(v.union(v.null(), v.string())),
			username: v.optional(v.union(v.null(), v.string())),
		}),
	},
	returns: currentProfileValidator,
	handler: async (ctx, input) => {
		const { profile, user } = await getOwnedProfile(ctx);
		const name = input.user.name === undefined ? profile.name : input.user.name?.trim();
		const username =
			input.user.username === undefined
				? profile.username
				: input.user.username?.trim().toLowerCase();
		if (!name || !orgNameSchema.safeParse(name).success) throw new ConvexError('INVALID_PROFILE');
		const parsedUsername = usernameSchema.safeParse(username);
		if (!parsedUsername.success) throw new ConvexError('INVALID_USERNAME');
		if (parsedUsername.data !== profile.username) {
			const conflict = await ctx.db
				.query('profiles')
				.withIndex('by_username', (q) => q.eq('username', parsedUsername.data))
				.unique();
			if (conflict && conflict.userId !== user._id) throw new ConvexError('USERNAME_TAKEN');
		}
		if (input.profile.bio !== undefined && (input.profile.bio?.length ?? 0) > 150)
			throw new ConvexError('INVALID_PROFILE');
		if (input.profile.location !== undefined && (input.profile.location?.length ?? 0) > 100)
			throw new ConvexError('INVALID_PROFILE');
		if (input.profile.urls !== undefined && input.profile.urls !== null) {
			const parsedUrls = urlListSchema.safeParse(input.profile.urls);
			if (!parsedUrls.success) throw new ConvexError('INVALID_PROFILE');
		}
		if (
			input.user.image !== undefined &&
			input.user.image !== null &&
			!httpUrlSchema.safeParse(input.user.image).success
		)
			throw new ConvexError('INVALID_PROFILE');
		const parsedUrls =
			input.profile.urls === undefined || input.profile.urls === null
				? input.profile.urls
				: urlListSchema.parse(input.profile.urls);
		await ctx.db.patch('profiles', profile._id, {
			name,
			username: parsedUsername.data,
			...(input.user.image === undefined ? {} : { imageUrl: input.user.image ?? undefined }),
			...(input.profile.bio === undefined ? {} : { bio: input.profile.bio ?? undefined }),
			...(input.profile.location === undefined
				? {}
				: { location: input.profile.location ?? undefined }),
			...(parsedUrls === undefined ? {} : { urls: parsedUrls ?? undefined }),
		});
		const updated = await currentProfile(ctx, user);
		if (!updated) throw new ConvexError('PROFILE_NOT_FOUND');
		return updated;
	},
});

export const updateLocale = mutation({
	args: { locale: localeValidator },
	returns: v.object({ locale: localeValidator }),
	handler: async (ctx, args) => {
		const { profile } = await getOwnedProfile(ctx);
		await ctx.db.patch('profiles', profile._id, { locale: args.locale });
		return { locale: args.locale };
	},
});

export const generateAvatarUploadUrl = mutation({
	args: {},
	returns: v.object({ uploadToken: v.string(), uploadUrl: v.string() }),
	handler: async (ctx) => {
		const { profile, user } = await getOwnedProfile(ctx);
		const now = Date.now();
		const existing = await ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_profileId', (q) => q.eq('profileId', profile._id))
			.take(MAX_PENDING_AVATAR_UPLOADS + 1);
		for (const intent of existing) {
			if (intent.expiresAt <= now) {
				await ctx.db.delete('profileAvatarUploadIntents', intent._id);
				if (intent.storageId) await deleteUnclaimedImageUpload(ctx, intent.storageId);
			}
		}
		if (existing.filter((intent) => intent.expiresAt > now).length >= MAX_PENDING_AVATAR_UPLOADS)
			throw new ConvexError('AVATAR_UPLOAD_LIMIT_REACHED');
		const uploadToken = crypto.randomUUID();
		await ctx.db.insert('profileAvatarUploadIntents', {
			createdAt: now,
			expiresAt: now + UPLOAD_INTENT_TTL_MS,
			profileId: profile._id,
			requestedByUserId: user._id,
			token: uploadToken,
		});
		return { uploadToken, uploadUrl: await ctx.storage.generateUploadUrl() };
	},
});

export const registerAvatarUpload = mutation({
	args: { storageId: v.id('_storage'), uploadToken: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { profile, user } = await getOwnedProfile(ctx);
		const intent = await ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', args.uploadToken))
			.unique();
		if (
			!intent ||
			intent.profileId !== profile._id ||
			intent.requestedByUserId !== user._id ||
			intent.expiresAt <= Date.now() ||
			(intent.storageId && intent.storageId !== args.storageId)
		)
			throw new ConvexError('INVALID_AVATAR_UPLOAD_INTENT');
		const metadata = await ctx.db.system.get('_storage', args.storageId);
		if (!metadata || metadata._creationTime < intent.createdAt)
			throw new ConvexError('AVATAR_UPLOAD_NOT_FOUND');
		await assertImageUploadUnclaimed(ctx, args.storageId, { kind: 'profile', id: intent._id });
		await ctx.db.patch('profileAvatarUploadIntents', intent._id, { storageId: args.storageId });
		return null;
	},
});

export const discardAvatarUpload = mutation({
	args: { uploadToken: v.string() },
	returns: v.boolean(),
	handler: async (ctx, { uploadToken }) => {
		const { profile, user } = await getOwnedProfile(ctx);
		const intent = await ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', uploadToken))
			.unique();
		if (!intent) return false;
		if (intent.profileId !== profile._id || intent.requestedByUserId !== user._id)
			throw new ConvexError('FORBIDDEN');
		await ctx.db.delete('profileAvatarUploadIntents', intent._id);
		if (intent.storageId) await deleteUnclaimedImageUpload(ctx, intent.storageId);
		return true;
	},
});

export const commitAvatar = mutation({
	args: { storageId: v.id('_storage'), uploadToken: v.string() },
	returns: v.object({ imageUrl: v.union(v.null(), v.string()) }),
	handler: async (ctx, args) => {
		const { profile, user } = await getOwnedProfile(ctx);
		const intent = await ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_token', (q) => q.eq('token', args.uploadToken))
			.unique();
		if (
			!intent ||
			intent.profileId !== profile._id ||
			intent.requestedByUserId !== user._id ||
			intent.expiresAt <= Date.now()
		)
			throw new ConvexError('INVALID_AVATAR_UPLOAD_INTENT');
		if (intent.storageId && intent.storageId !== args.storageId)
			throw new ConvexError('INVALID_AVATAR_UPLOAD_INTENT');
		await assertImageUploadUnclaimed(ctx, args.storageId, { kind: 'profile', id: intent._id });
		const [metadata, attached] = await Promise.all([
			ctx.db.system.get('_storage', args.storageId),
			ctx.db
				.query('profiles')
				.withIndex('by_avatarStorageId', (q) => q.eq('avatarStorageId', args.storageId))
				.unique(),
		]);
		if (!metadata) throw new ConvexError('AVATAR_UPLOAD_NOT_FOUND');
		if (metadata._creationTime < intent.createdAt)
			throw new ConvexError('AVATAR_UPLOAD_PREDATES_INTENT');
		if (!metadata.contentType || !ALLOWED_AVATAR_TYPES.has(metadata.contentType))
			throw new ConvexError('INVALID_AVATAR_TYPE');
		if (metadata.size > MAX_AVATAR_BYTES) throw new ConvexError('AVATAR_TOO_LARGE');
		if (attached && attached._id !== profile._id) throw new ConvexError('AVATAR_ALREADY_ATTACHED');
		await ctx.db.delete('profileAvatarUploadIntents', intent._id);
		const previousStorageId = profile.avatarStorageId;
		await ctx.db.patch('profiles', profile._id, { avatarStorageId: args.storageId });
		const imageUrl = await ctx.storage.getUrl(args.storageId);
		if (previousStorageId && previousStorageId !== args.storageId)
			await ctx.storage.delete(previousStorageId);
		return { imageUrl };
	},
});

export const clearExpiredAvatarUploadIntents = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const expired = await ctx.db
			.query('profileAvatarUploadIntents')
			.withIndex('by_expiresAt', (q) => q.lt('expiresAt', Date.now()))
			.take(100);
		for (const intent of expired) {
			await ctx.db.delete('profileAvatarUploadIntents', intent._id);
			if (intent.storageId) await deleteUnclaimedImageUpload(ctx, intent.storageId);
		}
		return expired.length;
	},
});
