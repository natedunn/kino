import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

const STALLED_AFTER_MS = 5 * 60 * 1000;
const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
const COMPLETED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const HISTORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PER_KIND_LIMIT = 25;
const DELIVERY_LIMIT = 25;

type Incident = {
	key: string;
	kind:
		| 'storage_cleanup'
		| 'project_deletion'
		| 'feedback_deletion'
		| 'update_deletion'
		| 'storage_project_purge'
		| 'board_deletion';
	jobId: string;
	targetId: string;
	state: 'failed' | 'stalled';
};

export const scanAlerts = internalMutation({
	args: {},
	returns: v.object({ active: v.number(), created: v.number(), resolved: v.number() }),
	handler: async (ctx) => {
		const now = Date.now();
		const [failed, pending, running, projects, feedback, updates, purges, boards] =
			await Promise.all([
				ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_state', (q) => q.eq('state', 'failed'))
					.order('asc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_state', (q) => q.eq('state', 'pending'))
					.order('asc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_state', (q) => q.eq('state', 'running'))
					.order('asc')
					.take(PER_KIND_LIMIT),
				ctx.db.query('projectDeletionJobs').order('asc').take(PER_KIND_LIMIT),
				ctx.db.query('feedbackDeletionJobs').order('asc').take(PER_KIND_LIMIT),
				ctx.db.query('updateDeletionJobs').order('asc').take(PER_KIND_LIMIT),
				ctx.db
					.query('storageProjectPurges')
					.withIndex('by_done', (q) => q.eq('done', false))
					.order('asc')
					.take(PER_KIND_LIMIT),
				ctx.db
					.query('feedbackBoards')
					.withIndex('by_deletingAt', (q) => q.gt('deletingAt', 0))
					.order('asc')
					.take(PER_KIND_LIMIT),
			]);
		const incidents: Array<Incident> = [];
		const add = (incident: Omit<Incident, 'key'>) =>
			incidents.push({ ...incident, key: `${incident.kind}:${incident.jobId}` });
		for (const job of failed)
			add({
				kind: 'storage_cleanup',
				jobId: job._id,
				targetId: job.objectId,
				state: 'failed',
			});
		for (const job of pending)
			if (job._creationTime + STALLED_AFTER_MS <= now)
				add({
					kind: 'storage_cleanup',
					jobId: job._id,
					targetId: job.objectId,
					state: 'stalled',
				});
		for (const job of running)
			if (job.leaseUntil <= now)
				add({
					kind: 'storage_cleanup',
					jobId: job._id,
					targetId: job.objectId,
					state: 'stalled',
				});
		for (const job of projects)
			if (job._creationTime + STALLED_AFTER_MS <= now)
				add({
					kind: 'project_deletion',
					jobId: job._id,
					targetId: job.projectId,
					state: 'stalled',
				});
		for (const job of feedback)
			if (job.startedAt + STALLED_AFTER_MS <= now)
				add({
					kind: 'feedback_deletion',
					jobId: job._id,
					targetId: job.feedbackId,
					state: 'stalled',
				});
		for (const job of updates)
			if (job._creationTime + STALLED_AFTER_MS <= now)
				add({
					kind: 'update_deletion',
					jobId: job._id,
					targetId: job.updateId,
					state: 'stalled',
				});
		for (const job of purges)
			if (job._creationTime + STALLED_AFTER_MS <= now)
				add({
					kind: 'storage_project_purge',
					jobId: job._id,
					targetId: job.projectId,
					state: 'stalled',
				});
		for (const board of boards)
			if (board.deletingAt && board.deletingAt + STALLED_AFTER_MS <= now)
				add({
					kind: 'board_deletion',
					jobId: board._id,
					targetId: board._id,
					state: 'stalled',
				});

		const active = await ctx.db
			.query('operationalAlerts')
			.withIndex('by_resolvedAt', (q) => q.eq('resolvedAt', undefined))
			.take(200);
		const incidentsByKey = new Map(incidents.map((incident) => [incident.key, incident]));
		const activeByKey = new Map(active.map((alert) => [alert.key, alert]));
		let created = 0;
		let scheduled = 0;
		for (const incident of incidents) {
			let alert = activeByKey.get(incident.key);
			if (!alert) {
				const previous = await ctx.db
					.query('operationalAlerts')
					.withIndex('by_key', (q) => q.eq('key', incident.key))
					.unique();
				if (previous?.suppressedUntil && previous.suppressedUntil > now) continue;
				if (previous) {
					await ctx.db.patch('operationalAlerts', previous._id, {
						...incident,
						firstSeenAt: now,
						lastSeenAt: now,
						lastSentAt: undefined,
						lastAttemptAt: undefined,
						resolvedAt: undefined,
						deliveryStatus: 'pending',
						attempt: 0,
					});
					alert = (await ctx.db.get('operationalAlerts', previous._id)) ?? undefined;
				} else {
					const id = await ctx.db.insert('operationalAlerts', {
						...incident,
						firstSeenAt: now,
						lastSeenAt: now,
						deliveryStatus: 'pending',
						attempt: 0,
					});
					alert = (await ctx.db.get('operationalAlerts', id)) ?? undefined;
					created += 1;
				}
			} else {
				await ctx.db.patch('operationalAlerts', alert._id, {
					state: incident.state,
					lastSeenAt: now,
				});
			}
			if (
				alert &&
				!alert.scheduledAt &&
				(!alert.lastAttemptAt || alert.lastAttemptAt + REMINDER_AFTER_MS <= now) &&
				scheduled < DELIVERY_LIMIT
			) {
				await ctx.db.patch('operationalAlerts', alert._id, {
					deliveryStatus: 'pending',
					scheduledAt: now,
					attempt: 0,
				});
				await ctx.scheduler.runAfter(0, internal.operationsMail.deliver, {
					alertId: alert._id,
					attempt: 0,
				});
				scheduled += 1;
			}
		}

		let resolved = 0;
		for (const alert of active)
			if (!incidentsByKey.has(alert.key)) {
				await ctx.db.patch('operationalAlerts', alert._id, {
					resolvedAt: now,
					scheduledAt: undefined,
				});
				resolved += 1;
			}
		return { active: incidents.length, created, resolved };
	},
});

export const cleanupHistory = internalMutation({
	args: {},
	returns: v.object({ alerts: v.number(), jobs: v.number(), maintenance: v.number() }),
	handler: async (ctx) => {
		const now = Date.now();
		const [doneJobs, alerts, maintenance] = await Promise.all([
			ctx.db
				.query('storageCleanupJobs')
				.withIndex('by_state', (q) => q.eq('state', 'done'))
				.order('asc')
				.take(100),
			ctx.db
				.query('operationalAlerts')
				.withIndex('by_resolvedAt', (q) => q.lt('resolvedAt', now - HISTORY_RETENTION_MS))
				.take(100),
			ctx.db
				.query('maintenanceJobs')
				.withIndex('by_status', (q) => q.eq('status', 'completed'))
				.order('asc')
				.take(100),
		]);
		const expiredJobs = doneJobs.filter(
			(job) => (job.finishedAt ?? job._creationTime) < now - COMPLETED_RETENTION_MS
		);
		const expiredMaintenance = maintenance.filter(
			(job) => (job.completedAt ?? job.updatedAt) < now - HISTORY_RETENTION_MS
		);
		for (const job of expiredJobs) await ctx.db.delete('storageCleanupJobs', job._id);
		for (const alert of alerts) await ctx.db.delete('operationalAlerts', alert._id);
		for (const job of expiredMaintenance) await ctx.db.delete('maintenanceJobs', job._id);
		return {
			alerts: alerts.length,
			jobs: expiredJobs.length,
			maintenance: expiredMaintenance.length,
		};
	},
});
