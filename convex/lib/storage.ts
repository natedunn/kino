import type { MutationCtx } from '../functions/generated/server';

import { CRPCError } from 'kitcn/server';

import { orgUploadsR2, userUploadsR2 } from './r2';

export const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ORG_AVATAR_BYTES = 5 * 1024 * 1024;

// Still-image formats only. GIF is intentionally excluded (animated); SVG is
// excluded for security (it can carry scripts). Keep this in sync with the
// client-side guard in the org general-settings route.
export const ALLOWED_ORG_AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Org avatars change rarely, so sign their URLs for a week. Combined with the
// client query cache this avoids re-issuing a fresh (uncacheable) signed URL on
// every navigation.
const ORG_AVATAR_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

type R2StorageMutationCtx = Pick<MutationCtx, 'db' | 'runMutation' | 'runQuery'>;

type ImageMetadata = {
	contentType?: string | null;
	size?: number;
};

type ProfileImageSource = {
	imageKey?: string | null;
	imageUrl?: string | null;
};

type OrganizationLogoSource = {
	logo?: string | null;
};

const ORG_AVATAR_PREFIX = 'ORG_AVATAR.';

export function getOrganizationLogoObjectKey(logo: string | null | undefined) {
	if (!logo?.startsWith(ORG_AVATAR_PREFIX)) return null;
	return logo.split('?')[0] ?? null;
}

export async function updateOrgStorageUsage(
	ctx: Pick<MutationCtx, 'db'>,
	orgSlug: string,
	byteDelta: number,
	fileCountDelta: number
) {
	const existing = await ctx.db
		.query('orgStorageUsage')
		.withIndex('by_orgSlug', (q: any) => q.eq('orgSlug', orgSlug))
		.unique();

	if (existing) {
		await ctx.db.patch(existing._id, {
			fileCount: Math.max(0, existing.fileCount + fileCountDelta),
			totalBytes: Math.max(0, existing.totalBytes + byteDelta),
			updatedTime: Date.now(),
		});
		return;
	}

	await ctx.db.insert('orgStorageUsage', {
		fileCount: Math.max(0, fileCountDelta),
		orgSlug,
		totalBytes: Math.max(0, byteDelta),
		updatedTime: Date.now(),
	});
}

export function validateCoverImageMetadata(metadata: ImageMetadata) {
	validateImageMetadata(metadata, {
		maxBytes: MAX_COVER_IMAGE_BYTES,
		tooLargeMessage: 'Cover images must be 5 MB or smaller',
		wrongTypeMessage: 'Cover image uploads must be image files',
	});
}

export function validateProfileImageMetadata(metadata: ImageMetadata) {
	validateImageMetadata(metadata, {
		maxBytes: MAX_PROFILE_IMAGE_BYTES,
		tooLargeMessage: 'Avatar images must be 5 MB or smaller',
		wrongTypeMessage: 'Avatar uploads must be image files',
	});
}

export function validateOrganizationLogoMetadata(metadata: ImageMetadata) {
	validateImageMetadata(metadata, {
		allowedContentTypes: ALLOWED_ORG_AVATAR_CONTENT_TYPES,
		maxBytes: MAX_ORG_AVATAR_BYTES,
		tooLargeMessage: 'Organization avatars must be 5 MB or smaller',
		wrongTypeMessage: 'Organization avatars must be a JPEG, PNG, or WebP image',
	});
}

function validateImageMetadata(
	metadata: ImageMetadata,
	args: {
		allowedContentTypes?: readonly string[];
		maxBytes: number;
		tooLargeMessage: string;
		wrongTypeMessage: string;
	}
) {
	if (args.allowedContentTypes) {
		// Strict allowlist: require a known still-image content type. A missing
		// content type is rejected so spoofed/empty types can't slip through.
		if (!metadata.contentType || !args.allowedContentTypes.includes(metadata.contentType)) {
			throw new CRPCError({
				code: 'BAD_REQUEST',
				message: args.wrongTypeMessage,
			});
		}
	} else if (metadata.contentType && !metadata.contentType.startsWith('image/')) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: args.wrongTypeMessage,
		});
	}

	if ((metadata.size ?? 0) > args.maxBytes) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: args.tooLargeMessage,
		});
	}
}

export async function resolveCoverImageUrl(key: string | null | undefined) {
	if (!key) return null;
	return await orgUploadsR2.getUrl(key, { expiresIn: 60 * 60 * 24 });
}

export async function getCoverImageR2Metadata(
	ctx: Pick<MutationCtx, 'runQuery'>,
	key: string | null | undefined
) {
	if (!key) return null;
	return await orgUploadsR2.getMetadata(ctx, key);
}

export async function getOrgUploadR2Metadata(
	ctx: Pick<MutationCtx, 'runQuery'>,
	key: string | null | undefined
) {
	if (!key) return null;
	return await orgUploadsR2.getMetadata(ctx, key);
}

export async function resolveUserUploadUrl(key: string | null | undefined) {
	if (!key) return null;
	return await userUploadsR2.getUrl(key, { expiresIn: 60 * 60 * 24 });
}

export async function getUserUploadR2Metadata(
	ctx: Pick<MutationCtx, 'runQuery'>,
	key: string | null | undefined
) {
	if (!key) return null;
	return await userUploadsR2.getMetadata(ctx, key);
}

export async function deleteCoverImageAttachment(
	ctx: R2StorageMutationCtx,
	args: {
		coverImageId?: string | null;
		orgSlug: string;
	}
) {
	const coverImageId = args.coverImageId ?? null;
	if (!coverImageId) return;

	const metadata = await getCoverImageR2Metadata(ctx, coverImageId);
	if (metadata) {
		await orgUploadsR2.deleteObject(ctx, coverImageId);
		await updateOrgStorageUsage(ctx, args.orgSlug, -(metadata.size ?? 0), -1);
	}
}

export async function resolveProfileImageUrl(profile: ProfileImageSource | null | undefined) {
	if (!profile) return null;
	if (profile.imageKey) {
		const r2Url = await resolveUserUploadUrl(profile.imageKey);
		if (r2Url) {
			return r2Url;
		}
	}
	return profile.imageUrl ?? null;
}

export async function resolveOrganizationLogoUrl(
	organization: OrganizationLogoSource | null | undefined
) {
	if (!organization?.logo) return null;
	const objectKey = getOrganizationLogoObjectKey(organization.logo);
	if (objectKey) {
		const r2Url = await orgUploadsR2.getUrl(objectKey, {
			expiresIn: ORG_AVATAR_URL_TTL_SECONDS,
		});
		if (r2Url) {
			return r2Url;
		}
	}
	return organization.logo;
}
