import { CRPCError } from 'kitcn/server';

import { asId, getDoc } from '../lib/kino';

export async function getActiveFeedbackOrThrow(ctx: any, feedbackId: string) {
	const feedback = await getDoc(ctx, asId<'feedback'>(feedbackId));
	if (!feedback) {
		throw new CRPCError({ code: 'NOT_FOUND', message: 'Feedback not found' });
	}
	return feedback;
}
