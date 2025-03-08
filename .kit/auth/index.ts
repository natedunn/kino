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
	organization,
	twoFactor,
	username,
} from 'better-auth/plugins';
import * as H from 'next/headers';

import { db } from '@/kit/db';
import { userSchema } from '@/lib/db/schema/auth';
import { env } from '@/lib/env/server';

const polarClient = new Polar({
	accessToken: env.POLAR_ACCESS_TOKEN,
	server: env.NODE_ENV === 'production' ? 'production' : 'sandbox',
});

export const auth = betterAuth({
	appName: 'Kino',
	emailAndPassword: {
		enabled: true,
	},
	database: drizzleAdapter(db, {
		provider: 'pg',
	}),
	socialProviders: {
		github: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
			mapProfileToUser: async (profile) => {
				return {
					username: profile.login,
					email: profile.email,
					image: profile.avatar_url,
					role: env.ADMIN_EMAIL === profile.email ? 'admin' : 'member',
				};
			},
		},
	},
	plugins: [
		nextCookies(),
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
			createCustomerOnSignUp: true,
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
				secret: env.POLAR_WEBHOOK_SECRET,
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
