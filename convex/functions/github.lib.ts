import type { GitHubInstallationDetails, GitHubRepository } from '../lib/github-client';

import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import { getCurrentProfileOrThrow, verifyOrgAccess } from '../lib/kino';
import {
	githubLoginSchema,
	githubNodeIdSchema,
	githubRepoFullNameSchema,
	githubRepoNameSchema,
	githubStateValueSchema,
	githubTitleSchema,
	githubUrlSchema,
} from '../lib/validation';

export const connectionModeSchema = z.enum(['read', 'read_write']);
export const sourceSchema = z.enum(['issues', 'discussions']);

export const githubInstallationSchema = z.object({
	account: z
		.object({
			id: z.number().int(),
			login: githubLoginSchema,
			type: z.string().trim().min(1).max(40),
		})
		.nullable(),
	events: z.array(z.string().trim().min(1).max(80)).max(100),
	id: z.number().int(),
	permissions: z.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(100)),
	repository_selection: z.string().trim().min(1).max(40),
});

export const githubRepositorySchema = z.object({
	full_name: githubRepoFullNameSchema,
	id: z.number().int(),
	name: githubRepoNameSchema,
	node_id: githubNodeIdSchema,
	owner: z.object({
		login: githubLoginSchema,
	}),
	private: z.boolean(),
});

export const verificationSummarySchema = z.object({
	discussions: z.object({
		enabled: z.boolean(),
		ok: z.boolean(),
	}),
	issues: z.object({
		ok: z.boolean(),
	}),
});

export async function getProjectBySlugs(ctx: any, args: { orgSlug: string; projectSlug: string }) {
	return await ctx.db
		.query('project')
		.withIndex('by_orgSlug_slug', (q: any) =>
			q.eq('orgSlug', args.orgSlug).eq('slug', args.projectSlug)
		)
		.unique();
}

export async function verifyOrgAdminForProject(
	ctx: any,
	args: { orgSlug: string; projectSlug: string; userId: string }
) {
	const project = await getProjectBySlugs(ctx, args);
	if (!project) {
		throw new CRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
	}

	const access = await verifyOrgAccess(ctx, {
		slug: args.orgSlug,
		userId: args.userId,
	});
	if (!access.organization) {
		throw new CRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found',
		});
	}
	if (!access.permissions.canCreate) {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message: 'Only organization admins can manage GitHub connections',
		});
	}

	const profile = await getCurrentProfileOrThrow(ctx, args.userId);

	return {
		organization: access.organization,
		profile,
		project,
	};
}

export async function verifyOrgAdmin(ctx: any, args: { orgSlug: string; userId: string }) {
	const access = await verifyOrgAccess(ctx, {
		slug: args.orgSlug,
		userId: args.userId,
	});
	if (!access.organization) {
		throw new CRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found',
		});
	}
	if (!access.permissions.canCreate) {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message: 'Only organization admins can manage GitHub connections',
		});
	}

	const profile = await getCurrentProfileOrThrow(ctx, args.userId);

	return {
		organization: access.organization,
		profile,
	};
}

export const webhookInstallationSchema = z.object({
	events: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
	id: z.number().int(),
	permissions: z
		.record(z.string().trim().min(1).max(100), z.string().trim().min(1).max(100))
		.optional(),
	repository_selection: z.string().trim().max(40).optional(),
});

export const webhookIssueSchema = z.object({
	nodeId: githubNodeIdSchema,
	number: z.number().int(),
	repositoryId: z.number().int(),
	state: githubStateValueSchema,
	title: githubTitleSchema,
	url: githubUrlSchema,
});

export type GithubInstallationForExternal = GitHubInstallationDetails;
export type GithubRepositoryForExternal = GitHubRepository;
