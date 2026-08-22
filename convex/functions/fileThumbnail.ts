'use node';

import { v } from 'convex/values';
import sharp from 'sharp';

import { orgUploadsR2, userUploadsR2 } from '../lib/r2';
import { getPublicFileThumbnailObjectKey } from '../shared/file-delivery';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

const THUMBNAIL_EDGE_PX = 128;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 100 * 1024;

export const generate = internalAction({
	args: { assetId: v.id('fileAsset') },
	returns: v.null(),
	handler: async (ctx, args) => {
		let generatedKey: string | null = null;
		let generatedBucket: 'org_uploads' | 'user_uploads' | null = null;
		try {
			const source = await ctx.runQuery(internal.file.getThumbnailSource, args);
			if (!source) return null;
			if (source.sizeBytes > MAX_SOURCE_BYTES) throw new Error('thumbnail source is too large');

			const r2 = source.bucketKind === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
			const response = await fetch(await r2.getUrl(source.objectKey, { expiresIn: 60 }));
			if (!response.ok) throw new Error('thumbnail source could not be loaded');
			const sourceBytes = new Uint8Array(await response.arrayBuffer());
			if (sourceBytes.byteLength > MAX_SOURCE_BYTES) {
				throw new Error('thumbnail source exceeded its verified size');
			}

			const thumbnail = await sharp(sourceBytes, {
				animated: false,
				failOn: 'error',
				limitInputPixels: 40_000_000,
				pages: 1,
			})
				.rotate()
				.resize(THUMBNAIL_EDGE_PX, THUMBNAIL_EDGE_PX, {
					fit: 'cover',
					position: 'centre',
					withoutEnlargement: true,
				})
				.webp({ effort: 4, quality: 74 })
				.toBuffer();
			if (thumbnail.byteLength > MAX_THUMBNAIL_BYTES) {
				throw new Error('generated thumbnail exceeded its size budget');
			}

			generatedBucket = source.bucketKind;
			generatedKey = source.publicId
				? getPublicFileThumbnailObjectKey(source.publicId)
				: `PROJECT_FILE_THUMBNAIL.${args.assetId}.${crypto.randomUUID()}.webp`;
			generatedKey = await r2.store(ctx, thumbnail, {
				cacheControl: 'public, max-age=31536000, immutable',
				key: generatedKey,
				type: 'image/webp',
			});
			const saved = await ctx.runMutation(internal.file.saveThumbnail, {
				assetId: args.assetId,
				bucketKind: source.bucketKind,
				bytes: thumbnail.byteLength,
				objectKey: generatedKey,
			});
			if (!saved.accepted) {
				await r2.deleteObject(ctx, generatedKey);
			}
			return null;
		} catch (error) {
			if (generatedKey && generatedBucket) {
				const r2 = generatedBucket === 'user_uploads' ? userUploadsR2 : orgUploadsR2;
				try {
					await r2.deleteObject(ctx, generatedKey);
				} catch {
					// The asset remains failed and an operational sweep can remove an orphaned derivative.
				}
			}
			console.warn('File thumbnail generation failed', { assetId: args.assetId, error });
			await ctx.runMutation(internal.file.markThumbnailFailed, { assetId: args.assetId });
			return null;
		}
	},
});
