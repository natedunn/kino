import type { GitHubIssueTarget, GitHubRepository } from '../lib/github-client';

import { CRPCError } from 'kitcn/server';
import { z } from 'zod';

import {
	asId,
	getCurrentProfileOrThrow,
	getDocOrThrow,
	toPublicDoc,
	verifyProjectAccess,
} from '../lib/kino';

export const kindSchema = z.literal('issue');

export type ConnectionKind = z.infer<typeof kindSchema>;
export type GitHubTarget = GitHubIssueTarget;

export function repositoryFromConnection(connection: {
	repoFullName: string;
	repoId: number;
	repoName: string;
	repoNodeId: string;
	repoOwner: string;
}): GitHubRepository {
	return {
		full_name: connection.repoFullName,
		id: connection.repoId,
		name: connection.repoName,
		node_id: connection.repoNodeId,
		owner: {
			login: connection.repoOwner,
		},
		private: false,
	};
}

export function buildKinoConnectionBody(args: { feedbackTitle: string; feedbackUrl: string }) {
	return `Connected to Kino Feedback: [${args.feedbackTitle}](${args.feedbackUrl})`;
}

export function assertCanUseConnection(args: { connection: any }) {
	if (args.connection.mode !== 'read_write') {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message:
				'This GitHub repository is connected read-only. Reconnect it with read/write access to connect feedback.',
		});
	}

	const source = 'issues';
	if (!args.connection.enabledSources?.includes(source)) {
		throw new CRPCError({
			code: 'BAD_REQUEST',
			message: `GitHub ${source} are not enabled for this project connection`,
		});
	}
}

export async function getActiveRepositoryConnection(ctx: any, projectId: string) {
	const connections = await ctx.db
		.query('githubRepositoryConnection')
		.withIndex('by_projectId', (q: any) => q.eq('projectId', projectId))
		.take(20);

	return connections.find((connection: any) => !connection.deletedTime) ?? null;
}

export async function getVerifiedContext(
	ctx: any,
	args: {
		feedbackId: string;
		kind: ConnectionKind;
		requireSource?: boolean;
		userId: string;
	}
) {
	const feedback = await getDocOrThrow(
		ctx,
		asId<'feedback'>(args.feedbackId),
		'Feedback not found'
	);

	const project = await getDocOrThrow(ctx, feedback.projectId, 'Project not found');
	const access = await verifyProjectAccess(ctx, {
		slug: project.slug,
		userId: args.userId,
	});
	if (!access.permissions.canEdit) {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message: 'Only project admins and editors can connect GitHub items',
		});
	}

	const profile = await getCurrentProfileOrThrow(ctx, args.userId);
	const connection = await getActiveRepositoryConnection(ctx, project._id);
	if (!connection) {
		throw new CRPCError({
			code: 'NOT_FOUND',
			message: 'Connect a GitHub repository before linking feedback',
		});
	}
	if (args.requireSource !== false) {
		assertCanUseConnection({ connection });
	} else if (connection.mode !== 'read_write') {
		throw new CRPCError({
			code: 'FORBIDDEN',
			message:
				'This GitHub repository is connected read-only. Reconnect it with read/write access to connect feedback.',
		});
	}

	const installation = await ctx.db.get('githubInstallation', connection.githubInstallationId);
	if (!installation || installation.status !== 'active') {
		throw new CRPCError({
			code: 'NOT_FOUND',
			message: 'GitHub installation is no longer active',
		});
	}

	return {
		connection: toPublicDoc(connection),
		feedback: toPublicDoc(feedback),
		installation: toPublicDoc(installation),
		profile: toPublicDoc(profile),
		project: toPublicDoc(project),
		repository: repositoryFromConnection(connection),
	};
}

export async function saveTarget(args: {
	caller: any;
	context: Awaited<ReturnType<typeof getVerifiedContext>>;
	kind: ConnectionKind;
	target: GitHubTarget;
}) {
	return await args.caller.saveConnection({
		connectedByProfileId: args.context.profile.id,
		feedbackId: args.context.feedback.id,
		githubDatabaseId: 'databaseId' in args.target ? args.target.databaseId : undefined,
		githubNodeId: args.target.nodeId,
		githubNumber: args.target.number,
		githubRepositoryConnectionId: args.context.connection.id,
		kind: args.kind,
		projectId: args.context.project.id,
		state: args.target.state,
		title: args.target.title,
		url: args.target.url,
	});
}
