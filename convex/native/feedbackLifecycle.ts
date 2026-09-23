import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

// A board tombstone closes every feedback entry point before bounded cleanup.
// This is a lifecycle check, not a replacement for project authorization.
export async function isFeedbackLive(ctx: QueryCtx, feedback: Doc<'feedback'> | null) {
	if (!feedback || feedback.deletingAt !== undefined) return false;
	const board = await ctx.db.get('feedbackBoards', feedback.boardId);
	return !!board && board.projectId === feedback.projectId && board.deletingAt === undefined;
}
