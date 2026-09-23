import auth from '@convex-dev/auth/core/convex.config';
import oauth from '@convex-dev/auth/providers/oauth/convex.config';
import password from '@convex-dev/auth/providers/password/convex.config';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';
import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
	env: {
		GITHUB_RELAY_APP_ID: v.optional(v.string()),
		GITHUB_RELAY_CLIENT_ID: v.optional(v.string()),
		GITHUB_RELAY_CLIENT_SECRET: v.optional(v.string()),
		GITHUB_RELAY_PRIVATE_KEY: v.optional(v.string()),
		GITHUB_RELAY_SLUG: v.optional(v.string()),
		GITHUB_RELAY_STATE_SECRET: v.optional(v.string()),
		GITHUB_RELAY_WEBHOOK_SECRET: v.optional(v.string()),
		GITHUB_RELAY_CALLBACK_TARGET_URL: v.optional(v.string()),
		NATIVE_R2_ENDPOINT: v.optional(v.string()),
		NATIVE_R2_BUCKET: v.optional(v.string()),
		NATIVE_R2_ACCESS_KEY_ID: v.optional(v.string()),
		NATIVE_R2_SECRET_ACCESS_KEY: v.optional(v.string()),
		NATIVE_FILES_ORIGIN: v.optional(v.string()),
		NATIVE_FILES_PURGE_ZONE_ID: v.optional(v.string()),
		NATIVE_FILES_PURGE_TOKEN: v.optional(v.string()),
		AUTH_PRIVATE_KEY: v.string(),
		AUTH_JWKS: v.string(),
		AUTH_GITHUB_CLIENT_ID: v.string(),
		AUTH_GITHUB_CLIENT_SECRET: v.string(),
		AUTH_GITHUB_CALLBACK_URL: v.string(),
		AUTH_APP_ORIGIN: v.string(),
		BENTO_PUBLISHABLE_KEY: v.optional(v.string()),
		BENTO_SECRET_KEY: v.optional(v.string()),
		BENTO_SITE_UUID: v.optional(v.string()),
		BENTO_FROM: v.optional(v.string()),
		NATIVE_OPERATIONS_ALERT_EMAIL: v.optional(v.string()),
	},
});

app.use(auth, {
	name: 'auth',
	httpPrefix: '/auth',
	env: {
		AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
		AUTH_JWKS: app.env.AUTH_JWKS,
	},
});
app.use(password, { name: 'password' });
app.use(rateLimiter, { name: 'authLimits' });
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
