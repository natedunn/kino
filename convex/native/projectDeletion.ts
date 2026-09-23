import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
import { requireProjectAccess } from './access';
import { deleteChildBatch } from './feedback';

// The same request resumes an interrupted cascade. The project remains as a
// fenced authorization anchor until every storage job has acknowledged cleanup.
export const remove = mutation({
	args: { id: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, { id }) => {
		const access = await requireProjectAccess(ctx, id, true);
		if (!access.permissions.canDelete) throw new ConvexError('FORBIDDEN');
		const job = await ctx.db
			.query('projectDeletionJobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', id))
			.unique();
		if (!job) {
			await ctx.db.insert('projectDeletionJobs', { projectId: id, invitationsDone: false });
			await ctx.db.patch('projects', id, { deletingAt: Date.now() });
		}
		await ctx.runMutation(internal.filesProjectPurge.begin, { projectId: id });
		await ctx.scheduler.runAfter(0, internal.projectDeletion.batch, { projectId: id });
		return null;
	},
});

export const batch = internalMutation({
	args: { projectId: v.id('projects') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const job = await ctx.db
			.query('projectDeletionJobs')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		const project = await ctx.db.get('projects', args.projectId);
		if (!job || !project || project.deletingAt === undefined) return null;
		const again = () => ctx.scheduler.runAfter(0, internal.projectDeletion.batch, args);
		const theme = await ctx.db
			.query('projectThemes')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		if (theme) await ctx.db.delete('projectThemes', theme._id);
		const relayStates = await ctx.db
			.query('relayStates')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(50);
		const relayConnections = await ctx.db
			.query('relayConnections')
			.withIndex('by_projectId_and_deletedTime', (q) => q.eq('projectId', args.projectId))
			.take(50);
		const relayIssues = await ctx.db
			.query('relayIssues')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of relayStates) await ctx.db.delete('relayStates', row._id);
		for (const row of relayConnections) await ctx.db.delete('relayConnections', row._id);
		for (const row of relayIssues) await ctx.db.delete('relayIssues', row._id);
		if (relayStates.length || relayConnections.length || relayIssues.length) {
			await again();
			return null;
		}
		const feedback = await ctx.db
			.query('feedback')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.first();
		if (feedback) {
			if (!(await deleteChildBatch(ctx, feedback._id))) {
				const deletion = await ctx.db
					.query('feedbackDeletionJobs')
					.withIndex('by_feedbackId', (q) => q.eq('feedbackId', feedback._id))
					.unique();
				if (deletion) await ctx.db.delete('feedbackDeletionJobs', deletion._id);
				await ctx.db.delete('feedback', feedback._id);
			}
			await again();
			return null;
		}
		const update = await ctx.db
			.query('updates')
			.withIndex('by_projectId_and_updatedAt', (q) => q.eq('projectId', args.projectId))
			.first();
		if (update) {
			await ctx.db.patch('updates', update._id, { deletingAt: update.deletingAt ?? Date.now() });
			await ctx.runMutation(internal.updates.deleteBatch, { id: update._id });
			await again();
			return null;
		}
		const boards = await ctx.db
			.query('feedbackBoards')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of boards) await ctx.db.delete('feedbackBoards', row._id);
		const assignments = await ctx.db
			.query('projectModeratorAssignments')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of assignments) await ctx.db.delete('projectModeratorAssignments', row._id);
		const members = await ctx.db
			.query('projectMembers')
			.withIndex('by_projectId_and_userId', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of members) await ctx.db.delete('projectMembers', row._id);
		if (boards.length === 50 || assignments.length === 50 || members.length === 50) {
			await again();
			return null;
		}
		if (!job.invitationsDone) {
			const invitations = await ctx.db
				.query('invitations')
				.withIndex('by_organizationId', (q) => q.eq('organizationId', project.organizationId))
				.paginate({ cursor: job.invitationsCursor ?? null, numItems: 50 });
			for (const invitation of invitations.page) {
				if (!invitation.projectIds.includes(args.projectId)) continue;
				const projectIds = invitation.projectIds.filter((id) => id !== args.projectId);
				await ctx.db.patch('invitations', invitation._id, {
					projectIds,
					status:
						invitation.status === 'pending' && invitation.role === 'moderator' && !projectIds.length
							? 'cancelled'
							: invitation.status,
				});
			}
			await ctx.db.patch('projectDeletionJobs', job._id, {
				invitationsCursor: invitations.continueCursor,
				invitationsDone: invitations.isDone,
			});
			await again();
			return null;
		}
		const purge = await ctx.db
			.query('storageProjectPurges')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		if (!purge?.done) return null; // cleanup acknowledgement wakes this job
		for (const state of ['pending', 'running', 'failed'] as const) {
			if (
				await ctx.db
					.query('storageCleanupJobs')
					.withIndex('by_projectId_and_state', (q) =>
						q.eq('projectId', args.projectId).eq('state', state)
					)
					.first()
			)
				return null;
		}
		const usage = await ctx.db
			.query('storageUsage')
			.withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
			.unique();
		if (usage && (usage.usedBytes || usage.reservedBytes || usage.fileCount))
			throw new Error('PROJECT_DELETE_STORAGE_NOT_EMPTY');
		const assets = await ctx.db
			.query('fileAssets')
			.withIndex('by_projectId_and_state_and_folderId', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of assets) {
			if (row.state !== 'deleted') throw new Error('PROJECT_DELETE_ASSET_NOT_SETTLED');
			await ctx.db.delete('fileAssets', row._id);
		}
		const objects = await ctx.db
			.query('fileObjects')
			.withIndex('by_projectId_and_state', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of objects) {
			if (row.accounting !== 'released') throw new Error('PROJECT_DELETE_OBJECT_NOT_SETTLED');
			await ctx.db.delete('fileObjects', row._id);
		}
		const cleanups = await ctx.db
			.query('storageCleanupJobs')
			.withIndex('by_projectId_and_state', (q) => q.eq('projectId', args.projectId))
			.take(50);
		for (const row of cleanups) await ctx.db.delete('storageCleanupJobs', row._id);
		if (assets.length === 50 || objects.length === 50 || cleanups.length === 50) {
			await again();
			return null;
		}
		if (usage) await ctx.db.delete('storageUsage', usage._id);
		await ctx.db.delete('storageProjectPurges', purge._id);
		await ctx.db.delete('projectDeletionJobs', job._id);
		await ctx.db.delete('projects', project._id);
		return null;
	},
});
