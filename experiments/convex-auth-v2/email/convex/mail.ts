import { v } from 'convex/values';

import { sendResetPasswordEmail, sendVerificationEmail } from '../../../../convex/emails/send';
import { internalAction } from './_generated/server';

export const deliver = internalAction({
	args: {
		email: v.string(),
		purpose: v.union(v.literal('verify'), v.literal('reset')),
		code: v.string(),
	},
	returns: v.null(),
	handler: async (_ctx, { email, purpose, code }) => {
		if (email !== process.env.PROOF_EMAIL) throw new Error('Unexpected proof recipient');
		// Fragment keeps the credential out of HTTP request URLs and access logs.
		const url = `http://127.0.0.1:5180/#${purpose}=${encodeURIComponent(code)}`;
		const send = purpose === 'verify' ? sendVerificationEmail : sendResetPasswordEmail;
		await send({ locale: 'en-US', user: { email }, url });
		return null;
	},
});
