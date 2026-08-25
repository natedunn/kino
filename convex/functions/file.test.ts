// @vitest-environment edge-runtime
import { describe, expect, it } from 'vitest';

import { commitReadyFile, getProjectStorageUsage, reserveProjectStorage } from '../lib/file-usage';
import { FREE_PROJECT_STORAGE_BYTES, MEBIBYTE } from '../shared/files';
import { api } from './_generated/api';
import {
	fileAssetTable,
	fileObjectTable,
	memberTable,
	organizationTable,
	profileTable,
	projectTable,
	sessionTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

async function seedFileManager(t: ReturnType<typeof convexTest>) {
	return t.run(async (baseCtx) => {
		const ctx = await runCtx(baseCtx);
		const [user] = await ctx.orm
			.insert(userTable)
			.values({
				createdAt: new Date(),
				email: 'files@example.com',
				emailVerified: true,
				name: 'File Manager',
				role: 'user',
				updatedAt: new Date(),
			})
			.returning();
		await ctx.orm.insert(profileTable).values({
			email: user.email,
			name: user.name,
			role: 'user',
			userId: user.id,
			username: 'file_manager',
		});
		const [organization] = await ctx.orm
			.insert(organizationTable)
			.values({ createdAt: new Date(), name: 'Files', slug: 'files-org', visibility: 'public' })
			.returning();
		await ctx.orm.insert(memberTable).values({
			createdAt: new Date(),
			organizationId: organization.id,
			role: 'admin',
			userId: user.id,
		});
		const [session] = await ctx.orm
			.insert(sessionTable)
			.values({
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86_400_000),
				token: 'file-manager-session',
				updatedAt: new Date(),
				userId: user.id,
			})
			.returning();
		const [project] = await ctx.orm
			.insert(projectTable)
			.values({
				name: 'Nested files',
				orgSlug: organization.slug,
				slug: 'nested-files',
				visibility: 'public',
			})
			.returning();
		return {
			orgSlug: organization.slug,
			projectId: project.id,
			sessionId: session.id,
			userId: user.id,
		};
	});
}

describe('project file storage accounting', () => {
	it('enforces the free project floor including reservations', async () => {
		const t = convexTest();
		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const [organization] = await ctx.orm
				.insert(organizationTable)
				.values({ createdAt: new Date(), name: 'Acme', slug: 'acme', visibility: 'public' })
				.returning();
			const [project] = await ctx.orm
				.insert(projectTable)
				.values({ name: 'Files', orgSlug: organization.slug, slug: 'files', visibility: 'public' })
				.returning();

			await reserveProjectStorage(ctx, {
				bytes: 60 * MEBIBYTE,
				orgSlug: organization.slug,
				projectId: project.id as never,
			});
			await reserveProjectStorage(ctx, {
				bytes: 40 * MEBIBYTE,
				orgSlug: organization.slug,
				projectId: project.id as never,
			});
			await expect(
				reserveProjectStorage(ctx, {
					bytes: 1,
					orgSlug: organization.slug,
					projectId: project.id as never,
				})
			).rejects.toThrow('project storage limit');

			const usage = await getProjectStorageUsage(ctx, project.id as never);
			expect(usage?.reservedBytes).toBe(FREE_PROJECT_STORAGE_BYTES);
		});
	});

	it('attributes hidden user uploads to the same project usage', async () => {
		const t = convexTest();
		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const [organization] = await ctx.orm
				.insert(organizationTable)
				.values({ createdAt: new Date(), name: 'Acme', slug: 'acme', visibility: 'public' })
				.returning();
			const [project] = await ctx.orm
				.insert(projectTable)
				.values({ name: 'Files', orgSlug: organization.slug, slug: 'files', visibility: 'public' })
				.returning();
			const declaredBytes = 2 * MEBIBYTE;
			await reserveProjectStorage(ctx, {
				bytes: declaredBytes,
				orgSlug: organization.slug,
				projectId: project.id as never,
			});
			const now = Date.now();
			const [asset] = await ctx.orm
				.insert(fileAssetTable)
				.values({
					access: 'private_user',
					category: 'image',
					createdTime: now,
					creationMethod: 'feature',
					extension: 'png',
					listing: 'unlisted',
					mimeType: 'image/png',
					name: 'attachment.png',
					normalizedName: 'attachment.png',
					originFeature: 'feedback_attachment',
					projectId: project.id as never,
					searchContent: 'attachment png image',
					sourceProvider: 'kino',
					status: 'pending',
					thumbnailBucketKind: 'user_uploads',
					thumbnailBytes: 80 * 1024,
					thumbnailMimeType: 'image/webp',
					thumbnailObjectKey: 'test-user-upload-thumbnail',
					thumbnailStatus: 'ready',
					updatedTime: now,
					uploaderClass: 'user',
				})
				.returning();
			const [object] = await ctx.orm
				.insert(fileObjectTable)
				.values({
					assetId: asset.id as never,
					bucketKind: 'user_uploads',
					createdTime: now,
					declaredBytes,
					declaredMimeType: 'image/png',
					objectKey: 'test-user-upload',
					orgSlug: organization.slug,
					projectId: project.id as never,
					status: 'pending',
					storageProvider: 'r2',
					updatedTime: now,
				})
				.returning();

			await commitReadyFile(ctx, {
				actualBytes: declaredBytes,
				category: 'image',
				object: object as never,
				originFeature: 'feedback_attachment',
				uploaderClass: 'user',
			});

			const usage = await getProjectStorageUsage(ctx, project.id as never);
			expect(usage).toMatchObject({ fileCount: 1, reservedBytes: 0, usedBytes: declaredBytes });
			expect(usage?.usedBytes).not.toBe(declaredBytes + 80 * 1024);
			expect(usage?.byUploaderClass).toEqual({
				user: { bytes: declaredBytes, files: 1 },
			});
		});
	});

	it('joins organization projects to usage without per-project lookups', async () => {
		const t = convexTest();
		const seed = await seedFileManager(t);
		const secondProjectId = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const [project] = await ctx.orm
				.insert(projectTable)
				.values({
					name: 'Second project',
					orgSlug: seed.orgSlug,
					slug: 'second-project',
					visibility: 'public',
				})
				.returning();
			await reserveProjectStorage(ctx, {
				bytes: 1234,
				orgSlug: seed.orgSlug,
				projectId: project.id as never,
			});
			return project.id;
		});
		const asManager = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });

		const usage = await asManager.query(api.file.getOrgUsage, { orgSlug: seed.orgSlug });

		expect(usage.totalReservedBytes).toBe(1234);
		expect(usage.projects).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fileCount: 0, id: seed.projectId, usedBytes: 0 }),
				expect.objectContaining({ id: secondProjectId, reservedBytes: 1234 }),
			])
		);
	});
});

describe('file folder hierarchy', () => {
	it('does not generate signed fallback URLs for legacy public files', async () => {
		const t = convexTest();
		const seed = await seedFileManager(t);
		const assetId = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const now = Date.now();
			const [asset] = await ctx.orm
				.insert(fileAssetTable)
				.values({
					access: 'public',
					category: 'text',
					createdTime: now,
					creationMethod: 'direct',
					extension: 'txt',
					listing: 'project_files',
					mimeType: 'text/plain',
					name: 'legacy.txt',
					normalizedName: 'legacy.txt',
					originFeature: 'files',
					projectId: seed.projectId as never,
					searchContent: 'legacy txt text',
					sourceProvider: 'kino',
					status: 'ready',
					updatedTime: now,
					uploaderClass: 'staff',
				})
				.returning();
			await ctx.orm.insert(fileObjectTable).values({
				actualBytes: 10,
				assetId: asset.id as never,
				bucketKind: 'org_uploads',
				createdTime: now,
				declaredBytes: 10,
				declaredMimeType: 'text/plain',
				objectKey: 'PROJECT_FILE.legacy.txt',
				orgSlug: seed.orgSlug,
				projectId: seed.projectId as never,
				status: 'ready',
				storageProvider: 'r2',
				updatedTime: now,
			});
			return asset.id;
		});

		const listing = await t.query(api.file.listProjectFiles, {
			cursor: null,
			limit: 50,
			projectId: seed.projectId,
		});
		expect(listing.page.find((file: any) => file.id === assetId)?.deliveryUrl).toBeNull();
		expect(
			await t.query(api.file.getFileDetail, {
				assetId,
				projectId: seed.projectId,
			})
		).toBeNull();
		expect(await t.query(api.file.getDownloadUrl, { assetId })).toBeNull();
	});

	it('returns lightweight visible file leaves for the reactive tree', async () => {
		const t = convexTest();
		const seed = await seedFileManager(t);
		const asManager = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });
		const uploads = await asManager.mutation(api.file.createFolder, {
			name: 'Uploads',
			parentFolderId: null,
			projectId: seed.projectId,
		});
		await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const now = Date.now();
			await ctx.orm.insert(fileAssetTable).values([
				{
					access: 'public',
					category: 'text',
					createdTime: now,
					creationMethod: 'direct',
					extension: 'md',
					folderId: uploads.id as never,
					listing: 'project_files',
					mimeType: 'text/markdown',
					name: 'Readme.md',
					normalizedName: 'readme.md',
					originFeature: 'files',
					projectId: seed.projectId as never,
					searchContent: 'readme md text',
					sourceProvider: 'kino',
					status: 'ready',
					updatedTime: now,
					uploaderClass: 'staff',
				},
				{
					access: 'private_user',
					category: 'image',
					createdTime: now,
					creationMethod: 'feature',
					extension: 'png',
					folderId: uploads.id as never,
					listing: 'unlisted',
					mimeType: 'image/png',
					name: 'Hidden.png',
					normalizedName: 'hidden.png',
					originFeature: 'feedback_attachment',
					projectId: seed.projectId as never,
					searchContent: 'hidden png image',
					sourceProvider: 'kino',
					status: 'ready',
					updatedTime: now,
					uploaderClass: 'user',
				},
			]);
		});

		const tree = await t.query(api.file.listFileTreeItems, { projectId: seed.projectId });
		expect(tree).toEqual({
			files: [
				expect.objectContaining({
					category: 'text',
					folderId: uploads.id,
					name: 'Readme.md',
				}),
			],
			truncated: false,
		});
	});

	it('creates nested folders and exposes their parent relationship', async () => {
		const t = convexTest();
		const seed = await seedFileManager(t);
		const asManager = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });
		const design = await asManager.mutation(api.file.createFolder, {
			name: 'Design',
			parentFolderId: null,
			projectId: seed.projectId,
		});
		const brand = await asManager.mutation(api.file.createFolder, {
			name: 'Brand',
			parentFolderId: design.id,
			projectId: seed.projectId,
		});

		const folders = await t.query(api.file.listFolders, { projectId: seed.projectId });
		expect(folders).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: design.id, name: 'Design' }),
				expect.objectContaining({ id: brand.id, name: 'Brand', parentFolderId: design.id }),
			])
		);
		expect(folders.find((folder: any) => folder.id === design.id)?.parentFolderId).toBeUndefined();
	});

	it('rejects cycles and duplicate sibling names when moving folders', async () => {
		const t = convexTest();
		const seed = await seedFileManager(t);
		const asManager = t.withIdentity({ sessionId: seed.sessionId, subject: seed.userId });
		const design = await asManager.mutation(api.file.createFolder, {
			name: 'Design',
			parentFolderId: null,
			projectId: seed.projectId,
		});
		const brand = await asManager.mutation(api.file.createFolder, {
			name: 'Brand',
			parentFolderId: design.id,
			projectId: seed.projectId,
		});
		const rootBrand = await asManager.mutation(api.file.createFolder, {
			name: 'Brand',
			parentFolderId: null,
			projectId: seed.projectId,
		});

		await expect(
			asManager.mutation(api.file.moveFolder, {
				folderId: design.id,
				parentFolderId: brand.id,
			})
		).rejects.toThrow('descendants');
		await expect(
			asManager.mutation(api.file.moveFolder, {
				folderId: brand.id,
				parentFolderId: null,
			})
		).rejects.toThrow('already exists');

		const folders = await t.query(api.file.listFolders, { projectId: seed.projectId });
		expect(folders.find((folder: any) => folder.id === brand.id)?.parentFolderId).toBe(design.id);
		expect(folders.find((folder: any) => folder.id === rootBrand.id)).toBeTruthy();
	});
});
