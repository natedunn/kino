import type { Id } from './_generated/dataModel';

import { createFunctionHandle } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { eq } from 'kitcn/orm';
import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { authMutation, authQuery, optionalAuthQuery } from '../lib/crpc';
import { getCurrentProfile, toPublicDoc } from '../lib/kino';
import { userUploadsR2 } from '../lib/r2';
import {
	getUserUploadR2Metadata,
	resolveProfileImageUrl,
	validateProfileImageMetadata,
} from '../lib/storage';
import {
	httpUrlSchema,
	orgNameSchema,
	storageKeySchema,
	urlListSchema,
	usernameSchema,
} from '../lib/validation';
import { internal } from './_generated/api';
import { internalMutation } from './generated/server';
import { toPublicProfileSummary } from './profile.lib';
import { profileTable } from './schema';

export const findMyProfile = authQuery.query(async ({ ctx }) => {
	const profile = await getCurrentProfile(ctx, ctx.userId);
	if (!profile) return null;

	return {
		...toPublicDoc(profile),
		imageUrl: (await resolveProfileImageUrl(profile)) ?? ctx.user.image ?? null,
	};
});

export const getByUsername = optionalAuthQuery
	.input(
		z.object({
			username: usernameSchema,
		})
	)
	.query(async ({ ctx, input }) => {
		const profile = await ctx.orm.query.profile.findFirst({
			where: { username: input.username },
		});

		if (!profile) {
			return null;
		}

		return await toPublicProfileSummary(ctx, profile);
	});

export const generateAvatarUploadUrl = authMutation
	.input(z.object({}))
	.mutation(async ({ ctx }) => {
		const profile = await getCurrentProfile(ctx, ctx.userId);
		if (!profile) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
		}

		return await userUploadsR2.generateUploadUrl(`PFP_${profile._id}`);
	});

export const syncMetadata = authMutation
	.input(
		z.object({
			key: storageKeySchema,
		})
	)
	.mutation(async ({ ctx, input }) => {
		const [type, profileId] = input.key.split('_');
		if (type !== 'PFP' || !profileId) {
			throw new ConvexError({
				code: '400',
				message: 'Invalid key format for avatar upload',
			});
		}

		const profile = await getCurrentProfile(ctx, ctx.userId);
		if (!profile) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
		}

		if (profile._id !== profileId) {
			throw new CRPCError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to upload this avatar',
			});
		}

		await ctx.orm
			.update(profileTable)
			.set({
				imageKey: input.key,
			})
			.where(eq(profileTable.id, profile._id));

		await ctx.scheduler.runAfter(0, userUploadsR2.component.lib.syncMetadata, {
			...userUploadsR2.config,
			key: input.key,
			onComplete: await createFunctionHandle(internal.profile.onAvatarMetadataSynced),
		});

		return null;
	});

export const onAvatarMetadataSynced = internalMutation({
	args: {
		bucket: v.string(),
		isNew: v.boolean(),
		key: v.string(),
	},
	handler: async (ctx, args) => {
		const [type, profileId] = args.key.split('_');
		if (type !== 'PFP' || !profileId) {
			throw new ConvexError({
				code: '400',
				message: 'Invalid key format for avatar upload',
			});
		}

		const profile = await ctx.db.get('profile', profileId as Id<'profile'>);
		if (!profile) return;

		const metadata = await getUserUploadR2Metadata(ctx, args.key);
		if (!metadata) return;

		validateProfileImageMetadata(metadata);
	},
});

export const update = authMutation
	.input(
		z.object({
			profile: z.object({
				bio: z.string().max(150).nullish(),
				imageKey: storageKeySchema.nullish(),
				location: z.string().max(100).nullish(),
				urls: urlListSchema.nullish(),
			}),
			user: z.object({
				image: httpUrlSchema.nullish(),
				name: orgNameSchema.nullish(),
				username: usernameSchema.nullish(),
			}),
		})
	)
	.mutation(async ({ ctx, input }) => {
		const profile = await getCurrentProfile(ctx, ctx.userId);
		if (!profile) {
			throw new CRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
		}

		if (input.user.username && input.user.username !== profile.username) {
			const existing = await ctx.db
				.query('profile')
				.withIndex('by_username', (q: any) => q.eq('username', input.user.username))
				.first();

			if (existing && existing.userId !== ctx.userId) {
				throw new CRPCError({
					code: 'BAD_REQUEST',
					message: 'Username is already taken',
				});
			}
		}

		const nextUser = Object.fromEntries(
			// Strip explicitly-undefined values before forwarding a partial update; the
			// input type doesn't model `undefined`, so the rule flags this defensively.
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			Object.entries(input.user).filter(([, value]) => value !== undefined)
		);
		if (Object.keys(nextUser).length > 0) {
			await ctx.auth.api.updateUser({
				body: nextUser,
				headers: ctx.headers,
			});
		}

		const nextProfile = Object.fromEntries(
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			Object.entries(input.profile).filter(([, value]) => value !== undefined)
		);
		if (Object.keys(nextProfile).length > 0) {
			await ctx.orm.update(profileTable).set(nextProfile).where(eq(profileTable.id, profile._id));
		}

		const updatedProfile = (await getCurrentProfile(ctx, ctx.userId)) ?? {
			...profile,
			...nextProfile,
		};

		return {
			...toPublicDoc(updatedProfile),
			imageUrl:
				(await resolveProfileImageUrl(updatedProfile)) ??
				input.user.image ??
				ctx.user.image ??
				null,
		};
	});
