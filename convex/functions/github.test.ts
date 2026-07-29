// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGitHubAppState, sha256Hex } from '../lib/github-client';
import { api, internal } from './_generated/api';
import {
	githubConnectionStateTable,
	githubInstallationTable,
	githubRepositoryConnectionTable,
	memberTable,
	organizationTable,
	profileTable,
	projectTable,
	sessionTable,
	userTable,
} from './schema';
import { convexTest, runCtx } from './setup.testing';

type Ctx = Awaited<ReturnType<typeof runCtx>>;

const ORIGINAL_ENV = { ...process.env };

function setGitHubRelayEnv() {
	Object.assign(process.env, {
		GITHUB_RELAY_APP_ID: '123',
		GITHUB_RELAY_CLIENT_ID: 'client-id',
		GITHUB_RELAY_CLIENT_SECRET: 'client-secret',
		GITHUB_RELAY_PRIVATE_KEY: 'private-key',
		GITHUB_RELAY_SLUG: 'kino-relay-test',
		GITHUB_RELAY_STATE_SECRET: 'state-secret',
		GITHUB_RELAY_WEBHOOK_SECRET: 'webhook-secret',
		SITE_URL: 'https://usekino.com',
	});
}

async function seedOrgAdmin(ctx: Ctx, suffix: string) {
	const now = new Date();
	const [user] = await ctx.orm
		.insert(userTable)
		.values({
			createdAt: now,
			email: `admin-${suffix}@example.com`,
			emailVerified: true,
			name: `Admin ${suffix}`,
			updatedAt: now,
		})
		.returning();
	const [profile] = await ctx.orm
		.insert(profileTable)
		.values({
			email: user.email,
			name: user.name,
			role: 'user',
			userId: user.id,
			username: `admin_${suffix}`,
		})
		.returning();
	const [organization] = await ctx.orm
		.insert(organizationTable)
		.values({
			createdAt: now,
			name: `Org ${suffix}`,
			slug: `org-${suffix}`,
			visibility: 'public',
		})
		.returning();
	await ctx.orm.insert(memberTable).values({
		createdAt: now,
		organizationId: organization.id,
		role: 'admin',
		userId: user.id,
	});
	const [session] = await ctx.orm
		.insert(sessionTable)
		.values({
			createdAt: now,
			expiresAt: new Date(now.getTime() + 86_400_000),
			token: `session-${suffix}`,
			updatedAt: now,
			userId: user.id,
		})
		.returning();
	const [project] = await ctx.orm
		.insert(projectTable)
		.values({
			name: `Project ${suffix}`,
			orgSlug: organization.slug,
			slug: `project-${suffix}`,
			visibility: 'public',
		})
		.returning();

	return { organization, profile, project, session, user };
}

async function seedInstallation(
	ctx: Ctx,
	args: {
		accountId: number;
		installationId: number;
		organization: Awaited<ReturnType<typeof seedOrgAdmin>>['organization'];
		profile: Awaited<ReturnType<typeof seedOrgAdmin>>['profile'];
		status: 'active' | 'deleted' | 'stale' | 'suspended';
	}
) {
	const [installation] = await ctx.orm
		.insert(githubInstallationTable)
		.values({
			accountId: args.accountId,
			accountLogin: `account-${args.accountId}`,
			accountType: 'User',
			connectedByProfileId: args.profile.id,
			events: ['issues'],
			installationId: args.installationId,
			orgId: args.organization.id,
			orgSlug: args.organization.slug,
			permissions: { issues: 'write', metadata: 'read' },
			repositorySelection: 'all',
			status: args.status,
			updatedTime: Date.now(),
		})
		.returning();
	return installation;
}

beforeEach(() => {
	setGitHubRelayEnv();
});

afterEach(() => {
	for (const key of Object.keys(process.env)) delete process.env[key];
	Object.assign(process.env, ORIGINAL_ENV);
});

describe('stale GitHub installations', () => {
	it('marks only active rows stale for a missing installation ID', async () => {
		const t = convexTest();
		const seeded = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const activeOrg = await seedOrgAdmin(ctx, 'active');
			const suspendedOrg = await seedOrgAdmin(ctx, 'suspended');
			const active = await seedInstallation(ctx, {
				accountId: 1,
				installationId: 100,
				organization: activeOrg.organization,
				profile: activeOrg.profile,
				status: 'active',
			});
			const suspended = await seedInstallation(ctx, {
				accountId: 2,
				installationId: 100,
				organization: suspendedOrg.organization,
				profile: suspendedOrg.profile,
				status: 'suspended',
			});
			return { activeId: active.id, suspendedId: suspended.id };
		});

		await t.mutation(internal.github.markInstallationStale, {
			installationId: 100,
		});

		const result = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return {
				active: await ctx.db.get('githubInstallation', seeded.activeId),
				suspended: await ctx.db.get('githubInstallation', seeded.suspendedId),
			};
		});
		expect(result.active?.status).toBe('stale');
		expect(result.suspended?.status).toBe('suspended');
	});

	it('separates stale installations from active organization installations', async () => {
		const t = convexTest();
		const seeded = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedOrgAdmin(ctx, 'query');
			await seedInstallation(ctx, {
				accountId: 1,
				installationId: 101,
				organization: admin.organization,
				profile: admin.profile,
				status: 'active',
			});
			await seedInstallation(ctx, {
				accountId: 2,
				installationId: 102,
				organization: admin.organization,
				profile: admin.profile,
				status: 'stale',
			});
			return {
				orgSlug: admin.organization.slug,
				projectSlug: admin.project.slug,
				sessionId: admin.session.id,
				userId: admin.user.id,
			};
		});
		const asAdmin = t.withIdentity({
			sessionId: seeded.sessionId,
			subject: seeded.userId,
		});

		const result = await asAdmin.query(api.github.getOrgIntegration, {
			orgSlug: seeded.orgSlug,
		});

		expect(result.installations.map((installation) => installation.installationId)).toEqual([101]);
		expect(result.staleInstallations.map((installation) => installation.installationId)).toEqual([
			102,
		]);

		const projectResult = await asAdmin.query(api.github.getProjectIntegration, {
			orgSlug: seeded.orgSlug,
			projectSlug: seeded.projectSlug,
		});
		expect(projectResult.installations.map((installation) => installation.installationId)).toEqual([
			101,
		]);
		expect(
			projectResult.staleInstallations.map((installation) => installation.installationId)
		).toEqual([102]);
	});

	it('rebinds a stale row after authorized refresh and preserves repository connections', async () => {
		const t = convexTest();
		const seeded = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedOrgAdmin(ctx, 'refresh');
			const stale = await seedInstallation(ctx, {
				accountId: 7,
				installationId: 200,
				organization: admin.organization,
				profile: admin.profile,
				status: 'stale',
			});
			const [connection] = await ctx.orm
				.insert(githubRepositoryConnectionTable)
				.values({
					connectedByProfileId: admin.profile.id,
					enabledSources: ['issues'],
					githubInstallationId: stale.id,
					issuesVerifiedAt: Date.now(),
					mode: 'read',
					orgId: admin.organization.id,
					orgSlug: admin.organization.slug,
					projectId: admin.project.id,
					projectSlug: admin.project.slug,
					repoFullName: 'account-7/repo',
					repoId: 300,
					repoName: 'repo',
					repoNodeId: 'R_repo',
					repoOwner: 'account-7',
					repoPrivate: false,
					verificationStatus: 'verified',
					verificationSummary: {
						discussions: { enabled: false, ok: false },
						issues: { ok: true },
					},
				})
				.returning();

			const nonce = 'refresh-state';
			const state = await createGitHubAppState({
				exp: Date.now() + 60_000,
				nonce,
				targetUrl: 'https://usekino.com/api/github/callback',
			});
			await ctx.orm.insert(githubConnectionStateTable).values({
				createdByProfileId: admin.profile.id,
				createdByUserId: admin.user.id,
				expiresAt: Date.now() + 60_000,
				mode: 'read',
				orgId: admin.organization.id,
				orgSlug: admin.organization.slug,
				projectId: admin.project.id,
				projectSlug: admin.project.slug,
				stateHash: await sha256Hex(nonce),
				status: 'pending',
				updatedTime: Date.now(),
			});

			return { connectionId: connection.id, staleId: stale.id, state };
		});

		await t.mutation(internal.github.completeUserInstallationsCallback, {
			deletedInstallationIds: [200],
			installations: [
				{
					authorizedRepositoryIds: [300],
					installation: {
						account: { id: 7, login: 'account-7', type: 'User' },
						events: ['issues'],
						id: 201,
						permissions: { issues: 'write', metadata: 'read' },
						repository_selection: 'all',
					},
				},
			],
			state: seeded.state,
		});

		const result = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return {
				connection: await ctx.db.get('githubRepositoryConnection', seeded.connectionId),
				installation: await ctx.db.get('githubInstallation', seeded.staleId),
			};
		});
		expect(result.installation).toMatchObject({
			_id: seeded.staleId,
			installationId: 201,
			status: 'active',
		});
		expect(result.connection?.githubInstallationId).toBe(seeded.staleId);
	});

	it('reattaches repository connections from a deleted row to the authorized active installation', async () => {
		const t = convexTest();
		const seeded = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedOrgAdmin(ctx, 'deleted-refresh');
			const deleted = await seedInstallation(ctx, {
				accountId: 8,
				installationId: 400,
				organization: admin.organization,
				profile: admin.profile,
				status: 'deleted',
			});
			const active = await seedInstallation(ctx, {
				accountId: 8,
				installationId: 401,
				organization: admin.organization,
				profile: admin.profile,
				status: 'active',
			});
			const [connection] = await ctx.orm
				.insert(githubRepositoryConnectionTable)
				.values({
					connectedByProfileId: admin.profile.id,
					enabledSources: ['issues'],
					githubInstallationId: deleted.id,
					issuesVerifiedAt: Date.now(),
					mode: 'read',
					orgId: admin.organization.id,
					orgSlug: admin.organization.slug,
					projectId: admin.project.id,
					projectSlug: admin.project.slug,
					repoFullName: 'account-8/repo',
					repoId: 402,
					repoName: 'repo',
					repoNodeId: 'R_deleted_repo',
					repoOwner: 'account-8',
					repoPrivate: false,
					verificationStatus: 'verified',
					verificationSummary: {
						discussions: { enabled: false, ok: false },
						issues: { ok: true },
					},
				})
				.returning();

			const nonce = 'deleted-refresh-state';
			const state = await createGitHubAppState({
				exp: Date.now() + 60_000,
				nonce,
				targetUrl: 'https://usekino.com/api/github/callback',
			});
			await ctx.orm.insert(githubConnectionStateTable).values({
				createdByProfileId: admin.profile.id,
				createdByUserId: admin.user.id,
				expiresAt: Date.now() + 60_000,
				mode: 'read',
				orgId: admin.organization.id,
				orgSlug: admin.organization.slug,
				projectId: admin.project.id,
				projectSlug: admin.project.slug,
				stateHash: await sha256Hex(nonce),
				status: 'pending',
				updatedTime: Date.now(),
			});

			return {
				activeId: active.id,
				connectionId: connection.id,
				deletedId: deleted.id,
				projectId: admin.project.id,
				state,
				userId: admin.user.id,
			};
		});

		const importPreparation = await t.query(internal.project.prepareGithubUrlImport, {
			id: seeded.projectId,
			userId: seeded.userId,
		});
		expect(importPreparation).toEqual({ recoveryRequired: true });

		await t.mutation(internal.github.completeUserInstallationsCallback, {
			deletedInstallationIds: [],
			installations: [
				{
					authorizedRepositoryIds: [402],
					installation: {
						account: { id: 8, login: 'account-8', type: 'User' },
						events: ['issues'],
						id: 401,
						permissions: { issues: 'write', metadata: 'read' },
						repository_selection: 'all',
					},
				},
			],
			state: seeded.state,
		});

		const result = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return {
				active: await ctx.db.get('githubInstallation', seeded.activeId),
				connection: await ctx.db.get('githubRepositoryConnection', seeded.connectionId),
				deleted: await ctx.db.get('githubInstallation', seeded.deletedId),
			};
		});
		expect(result.active?.status).toBe('active');
		expect(result.deleted?.status).toBe('deleted');
		expect(result.connection?.githubInstallationId).toBe(seeded.activeId);

		const repairedImportPreparation = await t.query(internal.project.prepareGithubUrlImport, {
			id: seeded.projectId,
			userId: seeded.userId,
		});
		expect(repairedImportPreparation).toMatchObject({
			installationId: 401,
			recoveryRequired: false,
			repoFullName: 'account-8/repo',
			repoId: 402,
		});
	});

	it('disconnects repositories excluded from a replacement installation', async () => {
		const t = convexTest();
		const seeded = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			const admin = await seedOrgAdmin(ctx, 'selected-refresh');
			const active = await seedInstallation(ctx, {
				accountId: 9,
				installationId: 500,
				organization: admin.organization,
				profile: admin.profile,
				status: 'active',
			});
			const [excludedProject] = await ctx.orm
				.insert(projectTable)
				.values({
					name: 'Excluded repository project',
					orgSlug: admin.organization.slug,
					slug: 'excluded-repository-project',
					visibility: 'public',
				})
				.returning();
			const connectionValues = {
				connectedByProfileId: admin.profile.id,
				enabledSources: ['issues'],
				githubInstallationId: active.id,
				issuesVerifiedAt: Date.now(),
				mode: 'read' as const,
				orgId: admin.organization.id,
				orgSlug: admin.organization.slug,
				repoOwner: 'account-9',
				repoPrivate: false,
				verificationStatus: 'verified',
				verificationSummary: {
					discussions: { enabled: false, ok: false },
					issues: { ok: true },
				},
			};
			const [allowedConnection] = await ctx.orm
				.insert(githubRepositoryConnectionTable)
				.values({
					...connectionValues,
					projectId: admin.project.id,
					projectSlug: admin.project.slug,
					repoFullName: 'account-9/allowed',
					repoId: 501,
					repoName: 'allowed',
					repoNodeId: 'R_allowed',
				})
				.returning();
			const [excludedConnection] = await ctx.orm
				.insert(githubRepositoryConnectionTable)
				.values({
					...connectionValues,
					projectId: excludedProject.id,
					projectSlug: excludedProject.slug,
					repoFullName: 'account-9/excluded',
					repoId: 502,
					repoName: 'excluded',
					repoNodeId: 'R_excluded',
				})
				.returning();

			const nonce = 'selected-refresh-state';
			const state = await createGitHubAppState({
				exp: Date.now() + 60_000,
				nonce,
				targetUrl: 'https://usekino.com/api/github/callback',
			});
			await ctx.orm.insert(githubConnectionStateTable).values({
				createdByProfileId: admin.profile.id,
				createdByUserId: admin.user.id,
				expiresAt: Date.now() + 60_000,
				mode: 'read',
				orgId: admin.organization.id,
				orgSlug: admin.organization.slug,
				stateHash: await sha256Hex(nonce),
				status: 'pending',
				updatedTime: Date.now(),
			});

			return {
				activeId: active.id,
				allowedConnectionId: allowedConnection.id,
				excludedConnectionId: excludedConnection.id,
				excludedProjectId: excludedProject.id,
				state,
				userId: admin.user.id,
			};
		});

		const refreshContext = await t.query(internal.github.getRefreshInstallationsForCallback, {
			state: seeded.state,
		});
		expect(refreshContext.repositoryTargets).toEqual([
			{
				accountId: 9,
				repositories: [
					{ fullName: 'account-9/allowed', id: 501 },
					{ fullName: 'account-9/excluded', id: 502 },
				],
			},
		]);

		await t.mutation(internal.github.completeUserInstallationsCallback, {
			deletedInstallationIds: [500],
			installations: [
				{
					authorizedRepositoryIds: [501],
					installation: {
						account: { id: 9, login: 'account-9', type: 'User' },
						events: ['issues'],
						id: 503,
						permissions: { issues: 'write', metadata: 'read' },
						repository_selection: 'selected',
					},
				},
			],
			state: seeded.state,
		});

		const result = await t.run(async (baseCtx) => {
			const ctx = await runCtx(baseCtx);
			return {
				allowed: await ctx.db.get('githubRepositoryConnection', seeded.allowedConnectionId),
				excluded: await ctx.db.get('githubRepositoryConnection', seeded.excludedConnectionId),
				installation: await ctx.db.get('githubInstallation', seeded.activeId),
			};
		});
		expect(result.installation).toMatchObject({
			installationId: 503,
			repositorySelection: 'selected',
			status: 'active',
		});
		expect(result.allowed).toMatchObject({
			githubInstallationId: seeded.activeId,
			verificationStatus: 'verified',
		});
		expect(result.allowed?.deletedTime).toBeUndefined();
		expect(result.excluded).toMatchObject({
			githubInstallationId: seeded.activeId,
			verificationStatus: 'unauthorized',
		});
		expect(result.excluded?.deletedTime).toEqual(expect.any(Number));
		await expect(
			t.query(internal.project.prepareGithubUrlImport, {
				id: seeded.excludedProjectId,
				userId: seeded.userId,
			})
		).rejects.toThrow('No connected GitHub repository');
	});
});
