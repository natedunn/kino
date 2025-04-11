'server only';

import type { NextRequest } from 'next/server';

import { cache } from 'react';
import { polar } from '@polar-sh/better-auth';
import { Polar } from '@polar-sh/sdk';
import { betterAuth } from 'better-auth';
import { emailHarmony } from 'better-auth-harmony';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import {
	admin,
	apiKey,
	createAuthMiddleware,
	oAuthProxy,
	organization,
	twoFactor,
	username,
} from 'better-auth/plugins';
import * as H from 'next/headers';

import { db } from '@/kit/db';
import { userSchema } from '@/lib/db/schema/auth';
import { env as envServer } from '@/lib/env/server';
import { env as envShared } from '@/lib/env/shared';

import { getBaseUrl } from '../utils';

const polarClient = new Polar({
	accessToken: envServer.POLAR_ACCESS_TOKEN,
	server: envShared.NODE_ENV === 'production' ? 'production' : 'sandbox',
});

export const auth = betterAuth({
	appName: 'Kino',
	baseURL: getBaseUrl({
		relativePath: false,
	}),
	advanced: {
		crossSubDomainCookies: {
			enabled: true,
			domain: `.${envShared.NEXT_PUBLIC_ROOT_DOMAIN}`,
		},
		defaultCookieAttributes: {
			partitioned: true,
			domain: `.${envShared.NEXT_PUBLIC_ROOT_DOMAIN}`,
		},
	},
	trustedOrigins: [
		'http://localhost:3000',
		`*.${envShared.NEXT_PUBLIC_ROOT_DOMAIN}`, //
	],
	emailAndPassword: {
		enabled: true,
	},
	database: drizzleAdapter(db, {
		provider: 'mysql',
	}),
	socialProviders: {
		github: {
			clientId: envServer.GITHUB_CLIENT_ID,
			clientSecret: envServer.GITHUB_CLIENT_SECRET,
			...(envServer?.OAUTH_PROXY_REDIRECT_URI
				? {
						redirectURI: envServer.OAUTH_PROXY_REDIRECT_URI,
					}
				: {}),
			mapProfileToUser: async (profile) => {
				return {
					username: profile.login,
					email: profile.email,
					image: profile.avatar_url,
					role: envServer.ADMIN_EMAIL === profile.email ? 'admin' : 'member',
				};
			},
		},
	},
	plugins: [
		nextCookies(),
		...(envServer?.OAUTH_PROXY_REDIRECT_URI ? [oAuthProxy()] : []),
		twoFactor(),
		emailHarmony(),
		username(),
		admin({
			defaultRole: 'member',
			adminRole: ['admin'],
		}),
		organization(),
		apiKey(),
		polar({
			client: polarClient,
			// createCustomerOnSignUp: true,
			enableCustomerPortal: true,
			getCustomerCreateParams: async ({ user }) => {
				return {
					emailVerified: user.emailVerified,
					metadata: {},
				};
			},
			checkout: {
				enabled: true,
				products: [
					{
						productId: '3453cca5-a3e7-45de-932a-a0882cfd65a9', // ID of Product from Polar Dashboard
						slug: '/checkout/pro1', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
					},
					{
						productId: 'c3338122-95bb-4213-863f-89b763cd3889',
						slug: '/checkout/pro2',
					},
					{
						productId: 'a64ff40f-fc5d-4943-83b8-519a727be43e',
						slug: '/checkout/pro3',
					},
					{
						productId: 'becd31b9-5884-4b75-9f43-6e682233baa2',
						slug: '/checkout/pro4',
					},
				],
				successUrl: '/success?checkout_id={CHECKOUT_ID}',
			},
			// Incoming Webhooks handler will be installed at /polar/webhooks
			webhooks: {
				secret: envServer.POLAR_WEBHOOK_SECRET,
				// someWebhookHandler: async (e) => {}
			},
		}),
	],
	user: {
		additionalFields: {
			// This purely exists to make sure the username is required when running auth table generation
			username: {
				type: 'string',
				required: true,
				sortable: true,
				unique: true,
				returned: true,
				transform: {
					input(value) {
						return value?.toString().toLowerCase();
					},
				},
			},
		},
	},
	hooks: {
		after: createAuthMiddleware(async () => {}),
	},
});

export const getAuth = cache(async (passedHeaders?: NextRequest['headers']) => {
	const headers = passedHeaders ?? (await H.headers());

	const session = await auth.api.getSession({
		headers,
	});

	return {
		session: session?.session ?? null,
		user: session?.user ? userSchema.read.parse(session.user) : null,
	};
});
