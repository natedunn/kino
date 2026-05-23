import { createEnv } from 'kitcn/server';
import { z } from 'zod';

const envSchema = z.object({
  SITE_URL: z.string().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().optional(),
  TRUSTED_ORIGINS: z.string().optional(),
});

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const getEnv = createEnv({
  schema: envSchema,
  runtimeEnv: {
    BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
    SITE_URL: runtimeEnv.SITE_URL,
    TRUSTED_ORIGINS: runtimeEnv.TRUSTED_ORIGINS,
  },
  cache: false,
});

function getRuntimeEnvValue(parts: string[]) {
  return runtimeEnv[parts.join('_')];
}

export function getGitHubOAuthEnv() {
  return {
    clientId: getRuntimeEnvValue(['GITHUB', 'CLIENT', 'ID']),
    clientSecret: getRuntimeEnvValue(['GITHUB', 'CLIENT', 'SECRET']),
  };
}

export function getJwksEnv() {
  return getRuntimeEnvValue(['JWKS']);
}

export function getOAuthProxySecretEnv() {
  return getRuntimeEnvValue(['OAUTH', 'PROXY', 'SECRET']);
}

function parseList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin: string) {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

function hostnameFromOriginPattern(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

export function getTrustedOrigins() {
  const env = getEnv();
  return Array.from(
    new Set([env.SITE_URL, ...parseList(env.TRUSTED_ORIGINS)].map(normalizeOrigin))
  );
}

export function getBetterAuthAllowedHosts() {
  return getTrustedOrigins().map(hostnameFromOriginPattern);
}

function patternToRegex(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

export function isTrustedOrigin(origin: string | undefined) {
  if (!origin) return false;
  const normalizedOrigin = normalizeOrigin(origin);
  return getTrustedOrigins().some((trustedOrigin) => {
    const normalizedTrustedOrigin = normalizeOrigin(trustedOrigin);
    return normalizedTrustedOrigin.includes('*')
      ? patternToRegex(normalizedTrustedOrigin).test(normalizedOrigin)
      : normalizedTrustedOrigin === normalizedOrigin;
  });
}
