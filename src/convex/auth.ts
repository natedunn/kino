import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth';

import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth';
import { admin, organization, username } from 'better-auth/plugins';
import { adjectives, nouns, uniqueUsernameGenerator } from 'unique-username-generator';

import { components, internal } from './_generated/api';
import { DataModel, Id } from './_generated/dataModel';
import authSchema from './betterAuth/schema';

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
	authFunctions,
	local: {
		schema: authSchema,
	},
	verbose: false,
	triggers: {
		organization: {
			onUpdate: async (ctx, newDoc, oldDoc) => {
				if (newDoc._id !== oldDoc._id) {
					throw new Error('Id mismatch in organization onUpdate trigger.');
				}

				// Update projects that have outdated slug
				if (newDoc.slug !== oldDoc.slug) {
					const projects = await ctx.db
						.query('project')
						.withIndex('by_orgSlug', (q) => q.eq('orgSlug', oldDoc.slug))
						.collect();

					for (const project of projects) {
						await ctx.db.patch(project._id, {
							orgSlug: newDoc.slug,
						});
					}
				}
			},
		},
		user: {
			onCreate: async (ctx, newUser) => {
				const generatedUsername = uniqueUsernameGenerator({
					length: 30,
					separator: '',
					style: 'snakeCase',
					dictionaries: [adjectives, nouns],
					randomDigits: 3,
				});

				const auth = createAuth(ctx);
				const username = (newUser.username ?? generatedUsername).toLowerCase();

				await auth.api.createOrganization({
					body: {
						slug: username,
						name: newUser.name,
						userId: newUser._id,
						visibility: 'public',
					},
				});

				const profileId = await ctx.db.insert('profile', {
					imageUrl: newUser.image ?? undefined,
					userId: newUser._id,
					email: newUser.email,
					username,
					role: 'member',
					name: newUser.name,
				});

				// Directly updating the column prevents onChange from running below
				await ctx.runMutation(components.betterAuth.user.updateUser, {
					_id: newUser._id,
					username: username,
					profileId,
				});
			},
			onDelete: async (ctx, user) => {
				const profileId = user.profileId as Id<'profile'>;
				await ctx.db.delete(profileId);
			},
			onUpdate: async (ctx, newUser, oldUser) => {
				if (oldUser._id !== newUser._id) {
					throw new Error('ID MISMATCH!');
				}

				const profileId = newUser.profileId as Id<'profile'>;

				if (!profileId) {
					console.error('Nothing to update: no userId found');
				} else {
					await ctx.db.patch(profileId, {
						imageUrl: newUser?.image ?? undefined,
						username: newUser.username!,
						email: newUser.email,
						role: newUser?.role ?? 'member',
						name: newUser.name,
					});
				}
			},
		},
	},
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		baseURL: process.env.SITE_URL!,
		trustedOrigins: ['http://localhost:3000', 'https://usekino.com'],
		database: authComponent.adapter(ctx),
		logger: {
			disabled: true,
		},
		account: {
			accountLinking: {
				enabled: true,
			},
		},
		user: {
			additionalFields: {
				profileId: {
					type: 'string',
					required: false,
				},
			},
			deleteUser: {
				enabled: true,
			},
		},
		socialProviders: {
			github: {
				clientId: process.env.GITHUB_CLIENT_ID as string,
				clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
			},
		},
		plugins: [
			username({
				minUsernameLength: 3,
				maxUsernameLength: 39,
			}),
			admin(),
			organization({
				schema: {
					organization: {
						additionalFields: {
							visibility: {
								type: 'string',
								required: false,
							},
						},
					},
				},
			}),
			convex(),
		],
	});
};
