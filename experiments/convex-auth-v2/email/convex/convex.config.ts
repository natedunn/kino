import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import { defineApp } from 'convex/server';
import { v } from 'convex/values';

import auth from '../../.revocation/packages/core/src/components/core/convex.config.ts';
import password from '../../.revocation/packages/core/src/components/password/convex.config.ts';
import oauth from '../../.revocation/packages/core/src/oauth/component/convex.config.ts';

const app = defineApp({
	env: {
		AUTH_GITHUB_CLIENT_ID: v.string(),
		AUTH_GITHUB_CLIENT_SECRET: v.string(),
		AUTH_GITHUB_CALLBACK_URL: v.string(),
		AUTH_PRIVATE_KEY: v.string(),
		AUTH_JWKS: v.string(),
		BENTO_PUBLISHABLE_KEY: v.string(),
		BENTO_SECRET_KEY: v.string(),
		BENTO_SITE_UUID: v.string(),
		BENTO_FROM: v.string(),
		PROOF_EMAIL: v.string(),
	},
});
app.use(auth, {
	httpPrefix: '/auth',
	env: {
		AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
		AUTH_JWKS: app.env.AUTH_JWKS,
	},
});
app.use(password, { name: 'password' });
app.use(rateLimiter, { name: 'emailLimits' });
app.use(oauth, {
	name: 'oauthGithub',
	httpPrefix: '/oauth/github',
	env: {
		CLIENT_ID: app.env.AUTH_GITHUB_CLIENT_ID,
		CLIENT_SECRET: app.env.AUTH_GITHUB_CLIENT_SECRET,
		CALLBACK_URL: app.env.AUTH_GITHUB_CALLBACK_URL,
	},
});
export default app;
