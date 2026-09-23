import type { MutationCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';
import { requireCurrentUser } from './identity';
import schema, { maintenanceKind } from './schema';

const STALLED_AFTER_MS = 5 * 60 * 1000;
const PER_KIND_LIMIT = 25;

const state = v.union(v.literal('pending'), v.literal('running'), v.literal('failed'));
const common = {
	createdAt: v.number(),
	lastError: v.union(v.null(), v.string()),
	staleAfter: v.number(),
	state,
};
const operationalJob = v.union(
	v.object({
		...common,
		kind: v.literal('storage_cleanup'),
		jobId: v.id('storageCleanupJobs'),
		projectId: v.id('projects'),
		targetId: v.id('fileObjects'),
		attempt: v.number(),
		maxAttempt: v.number(),
	}),
	v.object({
		...common,
		kind: v.literal('project_deletion'),
		jobId: v.id('projectDeletionJobs'),
		projectId: v.id('projects'),
		targetId: v.id('projects'),
		attempt: v.null(),
		maxAttempt: v.null(),
	}),
	v.object({
		...common,
		kind: v.literal('feedback_deletion'),
		jobId: v.id('feedbackDeletionJobs'),
		projectId: v.union(v.null(), v.id('projects')),
		targetId: v.id('feedback'),
		attempt: v.null(),
		maxAttempt: v.null(),
	}),
	v.object({
		...common,
		kind: v.literal('update_deletion'),
		jobId: v.id('updateDeletionJobs'),
		projectId: v.union(v.null(), v.id('projects')),
		targetId: v.id('updates'),
		attempt: v.null(),
		maxAttempt: v.null(),
	}),
	v.object({
		...common,
		kind: v.literal('storage_project_purge'),
		jobId: v.id('storageProjectPurges'),
		projectId: v.id('projects'),
		targetId: v.id('projects'),
		attempt: v.null(),
		maxAttempt: v.null(),
	}),
	v.object({
		...common,
		kind: v.literal('board_deletion'),
		jobId: v.id('feedbackBoards'),
		projectId: v.id('projects'),
		targetId: v.id('feedbackBoards'),
		attempt: v.null(),
		maxAttempt: v.null(),
	})
);

const jobReference = v.union(
	v.object({ kind: v.literal('storage_cleanup'), jobId: v.id('storageCleanupJobs') }),
	v.object({ kind: v.literal('project_deletion'), jobId: v.id('projectDeletionJobs') }),
	v.object({ kind: v.literal('feedback_deletion'), jobId: v.id('feedbackDeletionJobs') }),
	v.object({ kind: v.literal('update_deletion'), jobId: v.id('updateDeletionJobs') }),
	v.object({ kind: v.literal('storage_project_purge'), jobId: v.id('storageProjectPurges') }),
	v.object({ kind: v.literal('board_deletion'), jobId: v.id('feedbackBoards') })
);

async function requireSystemAdmin(ctx: Parameters<typeof requireCurrentUser>[0]) {
	const user = await requireCurrentUser(ctx);
	if (user.systemRole !== 'system:admin') throw new ConvexError('FORBIDDEN');
	return user;
}

// Convex 1.46 implements table counts, but its published type declarations hide
// the method while it remains internal. Keep that dependency isolated here.
function countTable(initializer: unknown): Promise<number> {
	return (initializer as { count: () => Promise<number> }).count();
}

export const getSystemMetrics = query({
	args: {},
	returns: v.object({
		counts: v.object({
			users: v.number(),
			organizations: v.number(),
			projects: v.number(),
			feedback: v.number(),
		}),
		recentUsers: v.array(
			v.object({
				id: v.id('users'),
				name: v.union(v.string(), v.null()),
				email: v.union(v.string(), v.null()),
				createdAt: v.number(),
			})
		),
	}),
	handler: async (ctx) => {
		await requireSystemAdmin(ctx);
		const [users, organizations, projects, feedback, recent] = await Promise.all([
			countTable(ctx.db.query('users')),
			countTable(ctx.db.query('organizations')),
			countTable(ctx.db.query('projects')),
			countTable(ctx.db.query('feedback')),
			ctx.db
				.query('users')
				.withIndex('by_status', (q) => q.eq('status', 'active'))
				.order('desc')
				.take(5),
		]);
		const recentUsers = await Promise.all(
			recent.map(async (user) => {
				const profile = user.profileId ? await ctx.db.get('profiles', user.profileId) : null;
				return {
					id: user._id,
					name: profile?.name ?? user.registrationName ?? null,
					email:
						user.passwordEmailVerifiedAt !== undefined
							? (user.passwordEmail ?? null)
							: user.githubEmailVerifiedAt !== undefined
								? (user.githubEmail ?? null)
								: null,
					createdAt: user._creationTime,
				};
			})
		);
		return { counts: { users, organizations, projects, feedback }, recentUsers };
	},
});

export const list = query({
	args: {},
	returns: v.array(operationalJob),
	handler: async (ctx) => {
		await requireSystemAdmin(ctx);
		const [pending, running, failed, projects, feedbackJobs, updateJobs, purges, boards] =
			await Promise.all([
				ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_state', (q) => q.eq('state', 'pending'))
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_state', (q) => q.eq('state', 'running'))
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_state', (q) => q.eq('state', 'failed'))
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('projectDeletionJobs')
					.withIndex('by_creation_time')
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('feedbackDeletionJobs')
					.withIndex('by_creation_time')
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('updateDeletionJobs')
					.withIndex('by_creation_time')
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('storageProjectPurges')
					.withIndex('by_done', (q) => q.eq('done', false))
					.order('desc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('feedbackBoards')
					.withIndex('by_deletingAt', (q) => q.gt('deletingAt', 0))
					.order('desc')
					.take(PER_KIND_LIMIT),
			]);

		const feedback = await Promise.all(
			feedbackJobs.map(async (job) => ({ job, item: await ctx.db.get('feedback', job.feedbackId) }))
		);
		const updates = await Promise.all(
			updateJobs.map(async (job) => ({ job, item: await ctx.db.get('updates', job.updateId) }))
		);
		return [
			...[...pending, ...running, ...failed].map((job) => ({
				kind: 'storage_cleanup' as const,
				jobId: job._id,
				projectId: job.projectId,
				targetId: job.objectId,
				createdAt: job._creationTime,
				staleAfter: job.state === 'running' ? job.leaseUntil : job._creationTime + STALLED_AFTER_MS,
				state:
					job.state === 'failed'
						? ('failed' as const)
						: job.state === 'running'
							? ('running' as const)
							: ('pending' as const),
				attempt: job.attempt,
				maxAttempt: job.maxAttempt,
				lastError: job.lastError ?? null,
			})),
			...projects.map((job) => ({
				kind: 'project_deletion' as const,
				jobId: job._id,
				projectId: job.projectId,
				targetId: job.projectId,
				createdAt: job._creationTime,
				staleAfter: job._creationTime + STALLED_AFTER_MS,
				state: 'running' as const,
				attempt: null,
				maxAttempt: null,
				lastError: null,
			})),
			...feedback.map(({ job, item }) => ({
				kind: 'feedback_deletion' as const,
				jobId: job._id,
				projectId: item?.projectId ?? null,
				targetId: job.feedbackId,
				createdAt: job._creationTime,
				staleAfter: job._creationTime + STALLED_AFTER_MS,
				state: 'running' as const,
				attempt: null,
				maxAttempt: null,
				lastError: null,
			})),
			...updates.map(({ job, item }) => ({
				kind: 'update_deletion' as const,
				jobId: job._id,
				projectId: item?.projectId ?? null,
				targetId: job.updateId,
				createdAt: job._creationTime,
				staleAfter: job._creationTime + STALLED_AFTER_MS,
				state: 'running' as const,
				attempt: null,
				maxAttempt: null,
				lastError: null,
			})),
			...purges.map((job) => ({
				kind: 'storage_project_purge' as const,
				jobId: job._id,
				projectId: job.projectId,
				targetId: job.projectId,
				createdAt: job._creationTime,
				staleAfter: job._creationTime + STALLED_AFTER_MS,
				state: 'running' as const,
				attempt: null,
				maxAttempt: null,
				lastError: null,
			})),
			...boards
				.filter((board) => board.deletingAt !== undefined)
				.map((board) => ({
					kind: 'board_deletion' as const,
					jobId: board._id,
					projectId: board.projectId,
					targetId: board._id,
					createdAt: board.deletingAt!,
					staleAfter: board.deletingAt! + STALLED_AFTER_MS,
					state: 'running' as const,
					attempt: null,
					maxAttempt: null,
					lastError: null,
				})),
		].sort((a, b) => b.createdAt - a.createdAt);
	},
});

export const resume = mutation({
	args: { job: jobReference },
	returns: v.null(),
	handler: async (ctx, { job: reference }) => {
		await requireSystemAdmin(ctx);
		const now = Date.now();
		switch (reference.kind) {
			case 'storage_cleanup': {
				const job = await ctx.db.get('storageCleanupJobs', reference.jobId);
				if (!job) throw new ConvexError('JOB_NOT_FOUND');
				const stalled = job.state === 'running' && job.leaseUntil <= now;
				if (job.state !== 'failed' && !stalled) return null;
				await ctx.db.patch('storageCleanupJobs', job._id, {
					state: 'pending',
					leaseUntil: 0,
					notBefore: now,
					maxAttempt: Math.max(job.maxAttempt, job.attempt + 3),
					lastError: undefined,
				});
				await ctx.scheduler.runAfter(0, internal.filesTransport.cleanup, { jobId: job._id });
				await suppressAlert(ctx, reference.kind, reference.jobId, now);
				return null;
			}
			case 'project_deletion': {
				const job = await ctx.db.get('projectDeletionJobs', reference.jobId);
				if (!job) throw new ConvexError('JOB_NOT_FOUND');
				await ctx.scheduler.runAfter(0, internal.projectDeletion.batch, {
					projectId: job.projectId,
				});
				await suppressAlert(ctx, reference.kind, reference.jobId, now);
				return null;
			}
			case 'feedback_deletion': {
				if (!(await ctx.db.get('feedbackDeletionJobs', reference.jobId)))
					throw new ConvexError('JOB_NOT_FOUND');
				await ctx.scheduler.runAfter(0, internal.feedback.processDeletionJob, {
					jobId: reference.jobId,
				});
				await suppressAlert(ctx, reference.kind, reference.jobId, now);
				return null;
			}
			case 'update_deletion': {
				const job = await ctx.db.get('updateDeletionJobs', reference.jobId);
				if (!job) throw new ConvexError('JOB_NOT_FOUND');
				await ctx.scheduler.runAfter(0, internal.updates.deleteBatch, { id: job.updateId });
				await suppressAlert(ctx, reference.kind, reference.jobId, now);
				return null;
			}
			case 'storage_project_purge': {
				const job = await ctx.db.get('storageProjectPurges', reference.jobId);
				if (!job || job.done) throw new ConvexError('JOB_NOT_FOUND');
				await ctx.scheduler.runAfter(0, internal.filesProjectPurge.batch, {
					projectId: job.projectId,
				});
				await suppressAlert(ctx, reference.kind, reference.jobId, now);
				return null;
			}
			case 'board_deletion': {
				const board = await ctx.db.get('feedbackBoards', reference.jobId);
				if (!board || board.deletingAt === undefined) throw new ConvexError('JOB_NOT_FOUND');
				await ctx.scheduler.runAfter(0, internal.feedbackBoards.purge, { boardId: board._id });
				await suppressAlert(ctx, reference.kind, reference.jobId, now);
				return null;
			}
		}
	},
});

export const listAlerts = query({
	args: {},
	returns: v.array(schema.doc('operationalAlerts')),
	handler: async (ctx) => {
		await requireSystemAdmin(ctx);
		return ctx.db.query('operationalAlerts').order('desc').take(20);
	},
});

export const listMaintenance = query({
	args: {},
	returns: v.array(schema.doc('maintenanceJobs')),
	handler: async (ctx) => {
		await requireSystemAdmin(ctx);
		return ctx.db.query('maintenanceJobs').order('desc').take(20);
	},
});

export const startMaintenance = mutation({
	args: { kind: maintenanceKind, dryRun: v.boolean() },
	returns: v.id('maintenanceJobs'),
	handler: async (ctx, args) => {
		const user = await requireSystemAdmin(ctx);
		for (const status of ['pending', 'running'] as const) {
			const existing = await ctx.db
				.query('maintenanceJobs')
				.withIndex('by_kind_and_status', (q) => q.eq('kind', args.kind).eq('status', status))
				.first();
			if (existing) throw new ConvexError('MAINTENANCE_ALREADY_RUNNING');
		}
		const now = Date.now();
		const jobId = await ctx.db.insert('maintenanceJobs', {
			kind: args.kind,
			status: 'pending',
			dryRun: args.dryRun,
			requestedByUserId: user._id,
			countA: 0,
			countB: 0,
			checked: 0,
			changed: 0,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.scheduler.runAfter(0, internal.operationsMaintenance.run, { jobId });
		return jobId;
	},
});

export const resumeMaintenance = mutation({
	args: { jobId: v.id('maintenanceJobs') },
	returns: v.null(),
	handler: async (ctx, { jobId }) => {
		await requireSystemAdmin(ctx);
		const job = await ctx.db.get('maintenanceJobs', jobId);
		if (!job) throw new ConvexError('JOB_NOT_FOUND');
		if (job.status === 'completed') return null;
		if (job.status !== 'failed' && job.updatedAt + STALLED_AFTER_MS > Date.now()) return null;
		await ctx.db.patch('maintenanceJobs', jobId, {
			status: 'pending',
			updatedAt: Date.now(),
			error: undefined,
		});
		await ctx.scheduler.runAfter(0, internal.operationsMaintenance.run, { jobId });
		return null;
	},
});

async function suppressAlert(ctx: MutationCtx, kind: string, jobId: string, now: number) {
	const alert = await ctx.db
		.query('operationalAlerts')
		.withIndex('by_key', (q) => q.eq('key', `${kind}:${jobId}`))
		.unique();
	if (alert)
		await ctx.db.patch('operationalAlerts', alert._id, {
			resolvedAt: now,
			suppressedUntil: now + STALLED_AFTER_MS,
			scheduledAt: undefined,
		});
}
