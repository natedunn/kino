import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

import { ConvexError, v } from 'convex/values';

import { VALIDATION_LIMITS } from '../shared/validation';
import { mutation, query } from './_generated/server';
import { isManager, readableTopic, writableTopic } from './forum';
import { adjustScore } from './forumStats';
import { getCurrentUser } from './identity';

export const MIN_POLL_OPTIONS = 2;

const pollValidator = v.object({
	id: v.id('forumPolls'),
	options: v.array(v.object({ id: v.string(), label: v.string(), votes: v.number() })),
	multiple: v.boolean(),
	voterCount: v.number(),
	closed: v.boolean(),
	// Empty when the viewer is signed out or hasn't voted.
	viewerOptionIds: v.array(v.string()),
	canVote: v.boolean(),
	canClose: v.boolean(),
});

async function pollForTopic(ctx: QueryCtx, topicId: Id<'forumTopics'>) {
	return ctx.db
		.query('forumPolls')
		.withIndex('by_topicId', (q) => q.eq('topicId', topicId))
		.first();
}

export async function topicHasPoll(ctx: QueryCtx, topicId: Id<'forumTopics'>) {
	return (await pollForTopic(ctx, topicId)) !== null;
}

async function viewerVote(
	ctx: QueryCtx,
	pollId: Id<'forumPolls'>,
	profileId: Id<'profiles'> | null
) {
	if (!profileId) return null;
	return ctx.db
		.query('forumPollVotes')
		.withIndex('by_pollId_and_profileId', (q) => q.eq('pollId', pollId).eq('profileId', profileId))
		.unique();
}

function validateOptions(values: Array<string>) {
	const labels = values.map((value) => value.trim());
	const seen = new Set(labels.map((label) => label.toLowerCase()));
	if (
		labels.length < MIN_POLL_OPTIONS ||
		labels.length > VALIDATION_LIMITS.forumPollOptions ||
		seen.size !== labels.length ||
		labels.some((label) => !label || label.length > VALIDATION_LIMITS.forumPollOption)
	)
		throw new ConvexError('INVALID_POLL');
	return labels;
}

// Called by `forum.create` so a topic and its poll are written together.
export async function insertPoll(
	ctx: MutationCtx,
	topic: { projectId: Id<'projects'>; topicId: Id<'forumTopics'> },
	input: { options: Array<string>; multiple: boolean }
) {
	const ids = new Set<string>();
	const options = validateOptions(input.options).map((label) => {
		let id = '';
		while (!id || ids.has(id)) id = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
		ids.add(id);
		return { id, label, votes: 0 };
	});
	return ctx.db.insert('forumPolls', {
		projectId: topic.projectId,
		topicId: topic.topicId,
		options,
		multiple: input.multiple,
		voterCount: 0,
	});
}

// Deletes one bounded batch of a topic's poll rows. Returns true while more remain.
export async function deleteTopicPollBatch(
	ctx: MutationCtx,
	topicId: Id<'forumTopics'>,
	batchSize: number
) {
	const votes = await ctx.db
		.query('forumPollVotes')
		.withIndex('by_topicId', (q) => q.eq('topicId', topicId))
		.take(batchSize);
	for (const row of votes) await ctx.db.delete('forumPollVotes', row._id);
	if (votes.length === batchSize) return true;
	const polls = await ctx.db
		.query('forumPolls')
		.withIndex('by_topicId', (q) => q.eq('topicId', topicId))
		.take(batchSize);
	for (const row of polls) await ctx.db.delete('forumPolls', row._id);
	return polls.length === batchSize;
}

async function writablePoll(ctx: MutationCtx, pollId: Id<'forumPolls'>) {
	const poll = await ctx.db.get('forumPolls', pollId);
	if (!poll) throw new ConvexError('POLL_NOT_FOUND');
	return { poll, ...(await writableTopic(ctx, poll.topicId)) };
}

export const get = query({
	args: { topicId: v.id('forumTopics') },
	returns: v.union(v.null(), pollValidator),
	handler: async (ctx, args) => {
		const topic = await ctx.db.get('forumTopics', args.topicId);
		const access = await readableTopic(ctx, topic);
		if (!topic || !access) return null;
		const poll = await pollForTopic(ctx, topic._id);
		if (!poll) return null;
		const viewerProfileId = (await getCurrentUser(ctx))?.profileId ?? null;
		const vote = await viewerVote(ctx, poll._id, viewerProfileId);
		const writable = !access.isArchived;
		const manager = isManager(access);
		const closed = poll.closedAt !== undefined;
		return {
			id: poll._id,
			options: poll.options,
			multiple: poll.multiple,
			voterCount: poll.voterCount,
			closed,
			viewerOptionIds: vote?.optionIds ?? [],
			// Like replying: signed-out visitors get the sign-in prompt, so only
			// closing or locking takes voting away.
			canVote: writable && !closed && (topic.lockedAt === undefined || manager),
			canClose:
				writable && !!viewerProfileId && (manager || viewerProfileId === topic.authorProfileId),
		};
	},
});

// Replaces the viewer's choices; an empty list withdraws their vote.
export const vote = mutation({
	args: { pollId: v.id('forumPolls'), optionIds: v.array(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, poll, topic, profileId } = await writablePoll(ctx, args.pollId);
		if (topic.lockedAt !== undefined && !isManager(access)) throw new ConvexError('TOPIC_LOCKED');
		if (poll.closedAt !== undefined) throw new ConvexError('POLL_CLOSED');
		const next = new Set(args.optionIds);
		const known = new Set(poll.options.map((option) => option.id));
		if ([...next].some((id) => !known.has(id)) || (!poll.multiple && next.size > 1))
			throw new ConvexError('INVALID_POLL_VOTE');
		const existing = await viewerVote(ctx, poll._id, profileId);
		const previous = new Set(existing?.optionIds ?? []);
		if (previous.size === next.size && [...next].every((id) => previous.has(id))) return null;
		const optionIds = poll.options.map((option) => option.id).filter((id) => next.has(id));
		if (existing && !optionIds.length) await ctx.db.delete('forumPollVotes', existing._id);
		else if (existing) await ctx.db.patch('forumPollVotes', existing._id, { optionIds });
		else
			await ctx.db.insert('forumPollVotes', {
				pollId: poll._id,
				topicId: topic._id,
				profileId,
				optionIds,
			});
		await ctx.db.patch('forumPolls', poll._id, {
			options: poll.options.map((option) => ({
				...option,
				votes: Math.max(
					0,
					option.votes - Number(previous.has(option.id)) + Number(next.has(option.id))
				),
			})),
			voterCount: Math.max(0, poll.voterCount - Number(!!existing) + Number(optionIds.length > 0)),
		});
		// Voters count toward the topic's "Top" score; changing a vote doesn't.
		await adjustScore(ctx, topic._id, Number(optionIds.length > 0) - Number(!!existing));
		return null;
	},
});

export const setClosed = mutation({
	args: { pollId: v.id('forumPolls'), closed: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const { access, poll, topic, profileId } = await writablePoll(ctx, args.pollId);
		if (topic.authorProfileId !== profileId && !isManager(access))
			throw new ConvexError('FORBIDDEN');
		if (args.closed === (poll.closedAt !== undefined)) return null;
		await ctx.db.patch('forumPolls', poll._id, {
			closedAt: args.closed ? Date.now() : undefined,
		});
		return null;
	},
});
