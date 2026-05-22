import { createEnv } from 'kitcn/server';
import { z } from 'zod';

const envSchema = z.object({
  DEPLOY_ENV: z.string().default('production'),
  SITE_URL: z.string().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().optional(),
  JWKS: z.string().optional(),
  CONVEX_SITE_URL: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const getEnv = createEnv({
  schema: envSchema,
  runtimeEnv: {
    BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
    CONVEX_SITE_URL: runtimeEnv.CONVEX_SITE_URL,
    DEPLOY_ENV: runtimeEnv.DEPLOY_ENV,
    GITHUB_CLIENT_ID: runtimeEnv.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: runtimeEnv.GITHUB_CLIENT_SECRET,
    JWKS: runtimeEnv.JWKS,
    SITE_URL: runtimeEnv.SITE_URL,
  },
  cache: false,
});
