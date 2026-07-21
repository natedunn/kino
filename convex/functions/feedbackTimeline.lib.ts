import type { ProfileImageUrlCache } from '../lib/storage';
import type { Doc } from './_generated/dataModel';
import type { CommentEnrichCache } from './feedback.lib';

import { asId } from '../lib/kino';
import { createProfileImageUrlCache } from '../lib/storage';
import { createCommentEnrichCache, toPublicFeedbackComment } from './feedback.lib';
import { enrichFeedbackEvent } from './feedbackEvent.lib';

// A feedback detail thread is a single chronological timeline of two kinds of
// item — comments and events — living in two tables. We window and paginate them
// together so one "load more" pages the whole thread. Convex allows only one
// `.paginate()` per query and cannot paginate across tables, so we merge manually
// with a `{ creationTime, id }` cursor (both tables share the `by_feedbackId`
// index, ordered by `_creationTime`). Head/tail are read live by
// `getDetailCritical`; the middle is fetched on demand as snapshot pages.

export const TIMELINE_HEAD_COUNT = 5;
export const TIMELINE_TAIL_COUNT = 10;
export const TIMELINE_MIDDLE_PAGE_SIZE = 20;

type RawItem =
	| { type: 'comment'; doc: Doc<'feedbackComment'>; creationTime: number; id: string }
	| { type: 'event'; doc: Doc<'feedbackEvent'>; creationTime: number; id: string };

type TimelineKey = { creationTime: number; id: string };

export type TimelineItem =
	| { type: 'comment'; id: string; createdAt: number; cursor: string; data: any }
	| { type: 'event'; id: string; createdAt: number; cursor: string; data: any };

function keyOf(item: RawItem): TimelineKey {
	return { creationTime: item.creationTime, id: item.id };
}

// Total order: creation time ascending, then id as a stable tiebreak for the rare
// case of two items sharing a millisecond.
function compareKeys(a: TimelineKey, b: TimelineKey): number {
	if (a.creationTime !== b.creationTime) return a.creationTime - b.creationTime;
	if (a.id < b.id) return -1;
	if (a.id > b.id) return 1;
	return 0;
}

export function encodeTimelineCursor(key: TimelineKey): string {
	return `${key.creationTime}:${key.id}`;
}

export function decodeTimelineCursor(cursor: string): TimelineKey | null {
	const separator = cursor.indexOf(':');
	if (separator < 0) return null;
	const creationTime = Number(cursor.slice(0, separator));
	const id = cursor.slice(separator + 1);
	if (!Number.isFinite(creationTime) || id.length === 0) return null;
	return { creationTime, id };
}

async function fetchRawComments(
	ctx: any,
	feedbackId: any,
	order: 'asc' | 'desc',
	limit: number,
	firstCommentId: any,
	sinceTime?: number
): Promise<Array<RawItem>> {
	const docs = await ctx.db
		.query('feedbackComment')
		.withIndex('by_feedbackId', (q: any) => {
			const scoped = q.eq('feedbackId', feedbackId);
			return sinceTime === undefined ? scoped : scoped.gte('_creationTime', sinceTime);
		})
		.order(order)
		.take(limit);
	// The initial "opened this feedback" comment is rendered separately (pinned), so
	// it never appears in the merged timeline.
	return docs
		.filter((doc: Doc<'feedbackComment'>) => doc._id !== firstCommentId)
		.map((doc: Doc<'feedbackComment'>) => ({
			type: 'comment' as const,
			doc,
			creationTime: doc._creationTime,
			id: doc._id,
		}));
}

async function fetchRawEvents(
	ctx: any,
	feedbackId: any,
	order: 'asc' | 'desc',
	limit: number,
	sinceTime?: number
): Promise<Array<RawItem>> {
	const docs = await ctx.db
		.query('feedbackEvent')
		.withIndex('by_feedbackId', (q: any) => {
			const scoped = q.eq('feedbackId', feedbackId);
			return sinceTime === undefined ? scoped : scoped.gte('_creationTime', sinceTime);
		})
		.order(order)
		.take(limit);
	return docs.map((doc: Doc<'feedbackEvent'>) => ({
		type: 'event' as const,
		doc,
		creationTime: doc._creationTime,
		id: doc._id,
	}));
}

function sortAsc(items: Array<RawItem>): Array<RawItem> {
	return items.sort((a, b) => compareKeys(keyOf(a), keyOf(b)));
}

async function enrichRawItem(
	ctx: any,
	item: RawItem,
	projectId: string,
	currentProfile: Doc<'profile'> | null,
	commentCache: CommentEnrichCache,
	imageUrlCache: ProfileImageUrlCache
): Promise<TimelineItem> {
	const cursor = encodeTimelineCursor(keyOf(item));
	if (item.type === 'comment') {
		return {
			type: 'comment',
			id: item.id,
			createdAt: item.creationTime,
			cursor,
			data: await toPublicFeedbackComment(
				ctx,
				item.doc,
				projectId,
				currentProfile,
				commentCache,
				imageUrlCache
			),
		};
	}
	return {
		type: 'event',
		id: item.id,
		createdAt: item.creationTime,
		cursor,
		data: await enrichFeedbackEvent(ctx, item.doc, imageUrlCache),
	};
}

// Enrich a set of raw items once each (deduped by id), returning a lookup so
// overlapping head/tail windows don't double-enrich shared items.
async function enrichUnique(
	ctx: any,
	items: Array<RawItem>,
	projectId: string,
	currentProfile: Doc<'profile'> | null,
	commentCache: CommentEnrichCache,
	imageUrlCache: ProfileImageUrlCache
): Promise<Map<string, TimelineItem>> {
	const uniqueById = new Map<string, RawItem>();
	for (const item of items) {
		if (!uniqueById.has(item.id)) uniqueById.set(item.id, item);
	}
	const enriched = new Map<string, TimelineItem>();
	await Promise.all(
		Array.from(uniqueById.values()).map(async (item) => {
			enriched.set(
				item.id,
				await enrichRawItem(ctx, item, projectId, currentProfile, commentCache, imageUrlCache)
			);
		})
	);
	return enriched;
}

/**
 * Live head/tail window over the merged comment+event timeline, plus cursors that
 * bound the collapsed middle. Read by `getDetailCritical` (a subscription), so new
 * comments and events both stream into the tail in real time.
 */
export async function getFeedbackTimelineWindow(
	ctx: any,
	args: {
		feedbackId: string;
		firstCommentId: any;
		projectId: string;
		currentProfile: Doc<'profile'> | null;
		// Optional request-scoped caches so the caller (e.g. `getDetailCritical`,
		// which also enriches the feedback author + pinned first comment) shares
		// author-doc lookups and avatar presigns with the timeline enrichment.
		commentCache?: CommentEnrichCache;
		imageUrlCache?: ProfileImageUrlCache;
	}
) {
	const feedbackId = asId<'feedback'>(args.feedbackId);
	const HEAD = TIMELINE_HEAD_COUNT;
	const TAIL = TIMELINE_TAIL_COUNT;

	// Over-fetch: up to HEAD+1 valid items can come from either table, and the
	// comment side may include the excluded initial comment (hence +2 there).
	const [headComments, headEvents, tailComments, tailEvents] = await Promise.all([
		fetchRawComments(ctx, feedbackId, 'asc', HEAD + 2, args.firstCommentId),
		fetchRawEvents(ctx, feedbackId, 'asc', HEAD + 1),
		fetchRawComments(ctx, feedbackId, 'desc', TAIL + 1, args.firstCommentId),
		fetchRawEvents(ctx, feedbackId, 'desc', TAIL),
	]);

	const headMerged = sortAsc([...headComments, ...headEvents]);
	const headRaw = headMerged.slice(0, HEAD);
	// The (HEAD+1)-th oldest item, if any — used to detect a middle gap.
	const probeItem = headMerged[HEAD] as RawItem | undefined;

	const tailMerged = [...tailComments, ...tailEvents].sort((a, b) =>
		compareKeys(keyOf(b), keyOf(a))
	);
	const tailRaw = tailMerged.slice(0, TAIL).reverse();
	const tailIds = new Set(tailRaw.map((item) => item.id));

	// A gap exists only if there is an item beyond the head that the tail doesn't
	// already cover.
	const hasMiddle = !!probeItem && !tailIds.has(probeItem.id);
	const middleCursor =
		hasMiddle && headRaw.length > 0
			? encodeTimelineCursor(keyOf(headRaw[headRaw.length - 1]))
			: null;
	const middleEndCursor =
		hasMiddle && tailRaw.length > 0 ? encodeTimelineCursor(keyOf(tailRaw[0])) : null;

	const commentCache = args.commentCache ?? createCommentEnrichCache();
	const imageUrlCache = args.imageUrlCache ?? createProfileImageUrlCache();
	const enriched = await enrichUnique(
		ctx,
		[...headRaw, ...tailRaw],
		args.projectId,
		args.currentProfile,
		commentCache,
		imageUrlCache
	);

	const head = headRaw.map((item) => enriched.get(item.id)).filter(Boolean) as Array<TimelineItem>;
	const tail = tailRaw.map((item) => enriched.get(item.id)).filter(Boolean) as Array<TimelineItem>;

	return { head, tail, middleCursor, middleEndCursor };
}

/**
 * One snapshot page of the collapsed middle: the next items strictly after
 * `cursor` and strictly before `endCursor` (the tail boundary).
 */
export async function getFeedbackTimelineMiddlePage(
	ctx: any,
	args: {
		cursor: string;
		endCursor?: string | null;
		feedbackId: string;
		projectId: string;
		currentProfile: Doc<'profile'> | null;
	}
): Promise<{ items: Array<TimelineItem>; nextCursor: string | null }> {
	const from = decodeTimelineCursor(args.cursor);
	if (!from) return { items: [], nextCursor: null };
	const end = args.endCursor ? decodeTimelineCursor(args.endCursor) : null;

	const feedbackId = asId<'feedback'>(args.feedbackId);
	const P = TIMELINE_MIDDLE_PAGE_SIZE;

	// Middle pages start after the head, so the initial (oldest) comment is always
	// behind `from` and can't appear — pass a nullish firstCommentId.
	const [comments, events] = await Promise.all([
		fetchRawComments(ctx, feedbackId, 'asc', P + 1, null, from.creationTime),
		fetchRawEvents(ctx, feedbackId, 'asc', P + 1, from.creationTime),
	]);

	const merged = sortAsc([...comments, ...events]).filter((item) => {
		const key = keyOf(item);
		if (compareKeys(key, from) <= 0) return false;
		if (end && compareKeys(key, end) >= 0) return false;
		return true;
	});

	const pageRaw = merged.slice(0, P);
	const hasMore = merged.length > P;

	const commentCache = createCommentEnrichCache();
	const imageUrlCache = createProfileImageUrlCache();
	const items = await Promise.all(
		pageRaw.map((item) =>
			enrichRawItem(ctx, item, args.projectId, args.currentProfile, commentCache, imageUrlCache)
		)
	);

	const nextCursor =
		hasMore && pageRaw.length > 0 ? encodeTimelineCursor(keyOf(pageRaw[pageRaw.length - 1])) : null;

	return { items, nextCursor };
}
