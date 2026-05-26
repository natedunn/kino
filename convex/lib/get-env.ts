import { createEnv } from 'kitcn/server';
import { z } from 'zod';

const envSchema = z.object({
  SITE_URL: z.string().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().optional(),
  TRUSTED_ORIGINS: z.string().optional(),
  TRUSTED_HOSTS: z.string().optional(),
  CLOUDFLARE_WORKER_NAME: z.string().optional(),
  OAUTH_PROXY_CURRENT_URL: z.string().optional(),
  OAUTH_PROXY_PRODUCTION_URL: z.string().optional(),
});

function getRuntimeEnv() {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

const DEFAULT_CLOUDFLARE_WORKER_NAME = 'kino';

export function getEnv() {
  const runtimeEnv = getRuntimeEnv();
  return createEnv({
    schema: envSchema,
    runtimeEnv: {
      BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
      SITE_URL: runtimeEnv.SITE_URL,
      TRUSTED_HOSTS: runtimeEnv.TRUSTED_HOSTS,
      TRUSTED_ORIGINS: runtimeEnv.TRUSTED_ORIGINS,
      OAUTH_PROXY_CURRENT_URL: runtimeEnv.OAUTH_PROXY_CURRENT_URL,
      OAUTH_PROXY_PRODUCTION_URL: runtimeEnv.OAUTH_PROXY_PRODUCTION_URL,
      CLOUDFLARE_WORKER_NAME:
        runtimeEnv.CLOUDFLARE_WORKER_NAME ??
        runtimeEnv.WORKER_NAME ??
        runtimeEnv.CF_WORKER_NAME ??
        DEFAULT_CLOUDFLARE_WORKER_NAME,
    },
    cache: false,
  })();
}

function getRuntimeEnvValue(parts: string[]) {
  return getRuntimeEnv()[parts.join('_')];
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

export function getOAuthProxyCurrentUrlEnv() {
  return getRuntimeEnvValue(['OAUTH', 'PROXY', 'CURRENT', 'URL']);
}

export function getOAuthProxyProductionUrlEnv() {
  return getRuntimeEnvValue(['OAUTH', 'PROXY', 'PRODUCTION', 'URL']);
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

function normalizeHostPattern(host: string) {
  return host
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function getLoopbackOrigins(siteUrl: string) {
  try {
    const { hostname } = new URL(siteUrl);
    if (!isLoopbackHostname(hostname)) return [];
  } catch {
    return [];
  }

  return ['http://localhost:*', 'http://127.0.0.1:*', 'http://[::1]:*'];
}

function getLoopbackHosts(siteUrl: string) {
  return getLoopbackOrigins(siteUrl).map(hostnameFromOriginPattern);
}

function hostnameFromOriginPattern(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return normalizeHostPattern(origin);
  }
}

function getCloudflarePreviewOrigins(workerName: string | undefined) {
  if (!workerName) return [];

  const normalizedWorkerName = workerName.trim().toLowerCase();
  if (!normalizedWorkerName) return [];

  return [
    `https://${normalizedWorkerName}.*.workers.dev`,
    `https://*-${normalizedWorkerName}.*.workers.dev`,
  ];
}

function getAdditionalDeploymentOrigins() {
  const runtimeEnv = getRuntimeEnv();
  const deploymentOrigins = [
    runtimeEnv.CF_PAGES_URL,
    runtimeEnv.URL,
    runtimeEnv.DEPLOY_PRIME_URL,
    runtimeEnv.RENDER_EXTERNAL_URL,
    runtimeEnv.VERCEL_URL
      ? `https://${runtimeEnv.VERCEL_URL.replace(/^https?:\/\//, '')}`
      : undefined,
  ];

  return deploymentOrigins
    .filter((origin): origin is string => typeof origin === 'string' && origin.length > 0)
    .map(normalizeOrigin);
}

export function getTrustedOrigins() {
  const env = getEnv();
  return Array.from(
    new Set(
      [
        env.SITE_URL,
        ...getLoopbackOrigins(env.SITE_URL),
        ...parseList(env.TRUSTED_ORIGINS),
        ...getAdditionalDeploymentOrigins(),
        ...getCloudflarePreviewOrigins(env.CLOUDFLARE_WORKER_NAME),
      ].map(normalizeOrigin)
    )
  );
}

export function getBetterAuthAllowedHosts() {
  const env = getEnv();
  return Array.from(
    new Set([
      ...getTrustedOrigins().map(hostnameFromOriginPattern),
      ...getLoopbackHosts(env.SITE_URL),
      ...parseList(env.TRUSTED_HOSTS).map(normalizeHostPattern),
    ])
  );
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
