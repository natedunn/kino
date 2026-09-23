'use node';

import {
	DeleteObjectsCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConvexError, v } from 'convex/values';

import sharp from 'sharp';
import { getPublicFileDeliveryUrl, getPublicFileThumbnailUrl } from '../shared/file-delivery';
import { getFileFormatPolicy, isAcceptedFileMimeType } from '../shared/files';
import { api, internal } from './_generated/api';
import { action, env, internalAction } from './_generated/server';

function storage() {
	if (
		!env.NATIVE_R2_ENDPOINT ||
		!env.NATIVE_R2_BUCKET ||
		!env.NATIVE_R2_ACCESS_KEY_ID ||
		!env.NATIVE_R2_SECRET_ACCESS_KEY
	)
		throw new Error('NATIVE_STORAGE_NOT_CONFIGURED');
	return {
		bucket: env.NATIVE_R2_BUCKET,
		client: new S3Client({
			region: 'auto',
			endpoint: env.NATIVE_R2_ENDPOINT,
			credentials: {
				accessKeyId: env.NATIVE_R2_ACCESS_KEY_ID,
				secretAccessKey: env.NATIVE_R2_SECRET_ACCESS_KEY,
			},
			maxAttempts: 2,
		}),
	};
}
export const start = action({
	args: {
		projectId: v.id('projects'),
		folderId: v.optional(v.union(v.id('fileFolders'), v.null())),
		updateId: v.optional(v.id('updates')),
		files: v.array(v.object({ name: v.string(), mimeType: v.string(), sizeBytes: v.number() })),
	},
	returns: v.array(
		v.object({ assetId: v.id('fileAssets'), url: v.string(), mimeType: v.string() })
	),
	handler: async (ctx, args) => {
		const { client, bucket } = storage();
		const intents = await ctx.runMutation(internal.files.reserveUpload, args);
		return Promise.all(
			intents.map(async (item) => ({
				assetId: item.assetId,
				mimeType: item.mimeType,
				url: await getSignedUrl(
					client,
					new PutObjectCommand({
						Bucket: bucket,
						Key: item.stagingKey,
						ContentType: item.mimeType,
						ContentLength: item.sizeBytes,
					}),
					{ expiresIn: Math.max(1, Math.floor((item.expiresAt - Date.now()) / 1000)) }
				),
			}))
		);
	},
});
export const complete = action({
	args: { assetId: v.id('fileAssets') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { client, bucket } = storage();
		const claimed = await ctx.runMutation(internal.files.claimUpload, args);
		if (!claimed) return null;
		const { object, asset, attempt } = claimed;
		try {
			// Read the staged snapshot once. Reusing a PUT URL cannot alter the verified
			// final object, and the snapshot size/type—not browser claims—drive accounting.
			const source = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: object.stagingKey }),
				{ abortSignal: AbortSignal.timeout(25_000) }
			);
			if (
				!source.Body ||
				source.ContentLength !== object.declaredBytes ||
				source.ContentLength > object.maxBytes
			)
				throw new Error('INVALID_UPLOAD_SIZE');
			const mimeType = source.ContentType ?? '';
			const policy = getFileFormatPolicy(asset.extension);
			if (!policy || !isAcceptedFileMimeType(policy, mimeType))
				throw new Error('INVALID_UPLOAD_TYPE');
			const bytes = await source.Body.transformToByteArray();
			if (bytes.byteLength !== object.declaredBytes) throw new Error('INVALID_UPLOAD_SIZE');
			let thumbnail: Buffer | undefined;
			if (policy.preview === 'image')
				thumbnail = await sharp(bytes, {
					animated: false,
					failOn: 'error',
					limitInputPixels: 40_000_000,
					pages: 1,
				})
					.rotate()
					.resize(128, 128, { fit: 'cover', withoutEnlargement: true })
					.webp({ effort: 4, quality: 74 })
					.toBuffer();
			if (thumbnail && thumbnail.byteLength > 100 * 1024) throw new Error('INVALID_THUMBNAIL_SIZE');
			await client.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: object.key,
					Body: bytes,
					ContentType: mimeType,
					CacheControl: 'private, no-store',
				}),
				{ abortSignal: AbortSignal.timeout(25_000) }
			);
			if (thumbnail)
				await client.send(
					new PutObjectCommand({
						Bucket: bucket,
						Key: `NATIVE_THUMB.${asset.publicId}.webp`,
						Body: thumbnail,
						ContentType: 'image/webp',
						CacheControl: 'private, no-store',
					}),
					{ abortSignal: AbortSignal.timeout(25_000) }
				);
			const accepted = await ctx.runMutation(internal.files.finishUpload, {
				objectId: object._id,
				attempt,
				bytes: bytes.byteLength,
				mimeType,
				thumbnailBytes: thumbnail?.byteLength,
				extractedText:
					policy.preview === 'text'
						? new TextDecoder().decode(bytes.slice(0, 64_000)).slice(0, 16_000)
						: undefined,
			});
			if (!accepted) throw new Error('UPLOAD_NO_LONGER_AUTHORIZED');
		} catch {
			await ctx.runMutation(internal.files.rejectUpload, { objectId: object._id, attempt });
			throw new ConvexError('INVALID_UPLOAD');
		}
		return null;
	},
});
export const download = action({
	args: {
		assetId: v.id('fileAssets'),
		thumbnail: v.optional(v.boolean()),
		inline: v.optional(v.boolean()),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		const source = await ctx.runQuery(internal.files.deliverySource, {
			assetId: args.assetId,
			thumbnail: args.thumbnail,
		});
		const publicId = /^NATIVE_(?:FILE|THUMB)\.([a-f0-9]{32})(?:\.webp)?$/.exec(source.key)?.[1];
		if (
			publicId &&
			env.NATIVE_FILES_ORIGIN &&
			(await ctx.runQuery(api.files.publicMetadata, { publicId }))
		) {
			const url = args.thumbnail
				? getPublicFileThumbnailUrl({ publicId, origin: env.NATIVE_FILES_ORIGIN })
				: getPublicFileDeliveryUrl({
						publicId,
						origin: env.NATIVE_FILES_ORIGIN,
						fileName: source.name,
					});
			if (url) return args.inline ? url : `${url}?download=1`;
		}
		const { client, bucket } = storage();
		const safeInline = args.thumbnail || getFileFormatPolicy(source.name)?.preview !== 'download';
		const filename = source.name.replace(/["\\\r\n]/g, '_').replace(/[^\x20-\x7e]/g, '_');
		return getSignedUrl(
			client,
			new GetObjectCommand({
				Bucket: bucket,
				Key: source.key,
				ResponseContentType: source.mimeType,
				ResponseCacheControl: 'private, no-store',
				ResponseContentDisposition: `${args.inline && safeInline ? 'inline' : 'attachment'}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(source.name)}`,
			}),
			{ expiresIn: 60 }
		);
	},
});
export const cleanup = internalAction({
	args: { jobId: v.id('storageCleanupJobs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const claimed = await ctx.runMutation(internal.filesJobs.claim, args);
		if (!claimed) return null;
		const { job, keys, publicId } = claimed;
		try {
			const { client, bucket } = storage();
			const removed = await client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
				}),
				{ abortSignal: AbortSignal.timeout(25_000) }
			);
			if (removed.Errors?.length) throw new Error('DELETE_FAILED');
			// Signed-only delivery needs no CDN purge. A configured public origin must
			// acknowledge a global tag purge before physical cleanup releases accounting.
			if (!job.stagingOnly && env.NATIVE_FILES_ORIGIN) {
				if (!env.NATIVE_FILES_PURGE_ZONE_ID || !env.NATIVE_FILES_PURGE_TOKEN)
					throw new Error('PURGE_NOT_CONFIGURED');
				const response = await fetch(
					`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(env.NATIVE_FILES_PURGE_ZONE_ID)}/purge_cache`,
					{
						method: 'POST',
						headers: {
							authorization: `Bearer ${env.NATIVE_FILES_PURGE_TOKEN}`,
							'content-type': 'application/json',
						},
						body: JSON.stringify({ tags: [`kino-file-${publicId}`] }),
						signal: AbortSignal.timeout(25_000),
					}
				);
				const body: unknown = await response.json();
				if (
					!response.ok ||
					!body ||
					typeof body !== 'object' ||
					!('success' in body) ||
					body.success !== true
				)
					throw new Error('PURGE_FAILED');
			}
			await ctx.runMutation(internal.filesJobs.acknowledge, {
				jobId: job._id,
				attempt: job.attempt,
			});
		} catch {
			await ctx.runMutation(internal.filesJobs.fail, { jobId: job._id, attempt: job.attempt });
		}
		return null;
	},
});
