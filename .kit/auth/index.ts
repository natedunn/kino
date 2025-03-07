'server only';

import type { NextRequest } from 'next/server';

import { cache } from 'react';
import { polar } from '@polar-sh/better-auth';
import { Polar } from '@polar-sh/sdk';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin, apiKey, organization, twoFactor, username } from 'better-auth/plugins';
import consola from 'consola';
import * as H from 'next/headers';

import { db } from '@/kit/db';
import { userSchema } from '@/lib/db/schema/auth';
import { env } from '@/lib/env/server';

const client = new Polar({
	accessToken: env.POLAR_ACCESS_TOKEN,
	server: env.NODE_ENV === 'production' ? 'production' : 'sandbox',
});

export const auth = betterAuth({
	appName: 'Kino',
	emailAndPassword: {
		enabled: true,
	},
	database: drizzleAdapter(db, {
		provider: 'pg', // or "mysql", "sqlite"
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
		username(),
		admin({
			defaultRole: 'member',
			adminRole: ['admin'],
		}),
		organization(),
		apiKey(),
		polar({
			client,
			// Enable automatic Polar Customer creation on signup
			createCustomerOnSignUp: true,
			// Enable customer portal
			enableCustomerPortal: true, // Deployed under /portal for authenticated users
			// Configure checkout
			checkout: {
				enabled: true,
				products: [
					{
						productId: '3453cca5-a3e7-45de-932a-a0882cfd65a9', // ID of Product from Polar Dashboard
						slug: '/checkout/pro1', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
					},
					{
						productId: 'c3338122-95bb-4213-863f-89b763cd3889', // ID of Product from Polar Dashboard
						slug: '/checkout/pro2', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
					},
					{
						productId: 'a64ff40f-fc5d-4943-83b8-519a727be43e', // ID of Product from Polar Dashboard
						slug: '/checkout/pro3', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
					},
					{
						productId: 'becd31b9-5884-4b75-9f43-6e682233baa2', // ID of Product from Polar Dashboard
						slug: '/checkout/pro4', // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
					},
				],
				successUrl: '/success?checkout_id={CHECKOUT_ID}',
			},
			// Incoming Webhooks handler will be installed at /polar/webhooks
			webhooks: {
				secret: process.env.POLAR_WEBHOOK_SECRET!,
				onPayload: async (e) => {
					consola.box(e);
				},
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
