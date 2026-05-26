import { describe, expect, it } from 'vitest';

import { getSafeRedirectTarget } from './auth';

describe('getSafeRedirectTarget', () => {
  it('defaults to the home page when redirect is missing', () => {
    expect(getSafeRedirectTarget(undefined)).toBe('/');
  });

  it('avoids redirecting back to the auth page after login', () => {
    expect(getSafeRedirectTarget('/auth')).toBe('/');
    expect(getSafeRedirectTarget('/auth?redirect=%2Fauth')).toBe('/');
  });

  it('preserves safe in-app redirect paths', () => {
    expect(getSafeRedirectTarget('/acme')).toBe('/acme');
    expect(getSafeRedirectTarget('/acme/project?tab=updates#latest')).toBe(
      '/acme/project?tab=updates#latest'
    );
  });
});
