import { afterEach, describe, expect, it } from 'vitest';

import {
  getBetterAuthAllowedHosts,
  getTrustedOrigins,
  isTrustedOrigin,
} from './get-env';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, ORIGINAL_ENV, overrides);
}

afterEach(() => {
  resetEnv({});
});

describe('trusted auth origins', () => {
  it('includes configured site, deployment urls, and Cloudflare preview patterns', () => {
    resetEnv({
      CF_PAGES_URL: 'https://kino-preview.pages.dev',
      CLOUDFLARE_WORKER_NAME: 'kino',
      SITE_URL: 'https://usekino.com',
      TRUSTED_ORIGINS: 'https://staging.usekino.com',
    });

    expect(getTrustedOrigins()).toEqual([
      'https://usekino.com',
      'https://staging.usekino.com',
      'https://kino-preview.pages.dev',
      'https://kino.*.workers.dev',
      'https://*-kino.*.workers.dev',
    ]);
  });

  it('derives allowed hosts from trusted origins and explicit host patterns', () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: 'kino',
      SITE_URL: 'https://usekino.com',
      TRUSTED_HOSTS: '*.internal.usekino.dev',
    });

    expect(getBetterAuthAllowedHosts()).toEqual([
      'usekino.com',
      'kino.*.workers.dev',
      '*-kino.*.workers.dev',
      '*.internal.usekino.dev',
    ]);
  });

  it('matches preview origins against wildcard patterns', () => {
    resetEnv({
      CLOUDFLARE_WORKER_NAME: 'kino',
      SITE_URL: 'https://usekino.com',
    });

    expect(isTrustedOrigin('https://feature-kino.team-subdomain.workers.dev')).toBe(true);
    expect(isTrustedOrigin('https://other-app.team-subdomain.workers.dev')).toBe(false);
  });
});
