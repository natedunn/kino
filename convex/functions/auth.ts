import { convex } from 'kitcn/auth';
import { admin, organization, username } from 'better-auth/plugins';
import {
  getBetterAuthAllowedHosts,
  getEnv,
  getGitHubOAuthEnv,
  getJwksEnv,
  getTrustedOrigins,
} from '../lib/get-env';
import authConfig from './auth.config';
import { defineAuth } from './generated/auth';
import { profileTable } from './schema';
import {
  createDefaultPersonalOrganization,
  ensureUniqueUsername,
  setUserProfileId,
} from '../lib/kino';

function isSuperAdminEmail(email: string) {
  const configured = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.SUPER_ADMIN_EMAIL;
  return !!configured && configured.toLowerCase() === email.toLowerCase();
}

export default defineAuth(() => {
  const env = getEnv();
  const githubOAuth = getGitHubOAuthEnv();
  const jwks = getJwksEnv();
  const trustedOrigins = getTrustedOrigins();
  const baseURLProtocol: 'auto' | 'https' = env.SITE_URL.startsWith('http://') ? 'auto' : 'https';
  const baseOptions = {
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    advanced: {
      trustedProxyHeaders: true,
    },
    emailAndPassword: {
      enabled: true,
    },
    baseURL: {
      allowedHosts: getBetterAuthAllowedHosts(),
      fallback: env.SITE_URL,
      protocol: baseURLProtocol,
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
                required: true,
                type: 'string',
              },
            },
          },
        },
      }),
      convex({
        authConfig,
        jwks,
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 15,
    },
    telemetry: { enabled: false },
    trustedOrigins,
    user: {
      additionalFields: {
        profileId: {
          type: 'string' as const,
          required: false,
        },
      },
    },
    triggers: {
    organization: {
      change: async (change: any, ctx: any) => {
        if (change.operation !== 'update') return;

        const db = (ctx as any).db;
        if (change.newDoc.slug !== change.oldDoc.slug) {
          const projects = await db
            .query('project')
            .withIndex('by_orgSlug', (q: any) => q.eq('orgSlug', change.oldDoc.slug))
            .collect();

          await Promise.all(
            projects.map((project: any) => db.patch(project._id, { orgSlug: change.newDoc.slug }))
          );
        }
      },
    },
    user: {
      create: {
        before: async (data: any, ctx: any) => {
          const orm = (ctx as any).orm;
          const usernameValue =
            data.username ?? data.email.split('@')[0] ?? data.name ?? `user_${crypto.randomUUID().slice(0, 8)}`;
          const resolvedUsername = await ensureUniqueUsername({ db: (ctx as any).db, orm }, usernameValue);
          return {
            data: {
              ...data,
              role: isSuperAdminEmail(data.email) ? 'system:admin' : data.role ?? 'user',
              username: resolvedUsername,
            },
          };
        },
        after: async (user: any, ctx: any) => {
          const orm = (ctx as any).orm;
          const [profile] = await orm
            .insert(profileTable)
            .values({
              email: user.email,
              imageKey: null,
              imageUrl: user.image,
              name: user.name,
              role:
                user.role === 'system:admin' || user.role === 'system:editor' || user.role === 'user'
                  ? user.role
                  : 'user',
              userId: user._id,
              username: user.username ?? user.email.split('@')[0] ?? `user_${crypto.randomUUID().slice(0, 8)}`,
            })
            .returning();

          await setUserProfileId(ctx as any, user._id, profile.id);
          await createDefaultPersonalOrganization({ orm }, {
            id: user._id,
            name: user.name,
            username: user.username ?? profile.username,
          });
        },
      },
      change: async (change: any, ctx: any) => {
        if (change.operation === 'delete') {
          const profileId = change.oldDoc.profileId;
          if (!profileId) return;
          const db = (ctx as any).db;
          const profile = await db.get(profileId as any);
          if (!profile) return;
          await db.delete(profile._id);
          return;
        }

        const profileId = change.newDoc.profileId;
        if (!profileId) return;

        const role =
          change.newDoc.role === 'system:admin' ||
          change.newDoc.role === 'system:editor' ||
          change.newDoc.role === 'user'
            ? change.newDoc.role
            : 'user';

        const db = (ctx as any).db;
        const profile = await db.get(profileId as any);
        if (!profile) return;
        await db.patch(profile._id, {
          email: change.newDoc.email,
          imageUrl: change.newDoc.image,
          name: change.newDoc.name,
          role,
          username: change.newDoc.username ?? undefined,
        });
      },
    },
    },
  };

  if (githubOAuth.clientId && githubOAuth.clientSecret) {
    return {
      ...baseOptions,
      socialProviders: {
        github: {
          clientId: githubOAuth.clientId,
          clientSecret: githubOAuth.clientSecret,
        },
      },
    };
  }

  return baseOptions;
});
