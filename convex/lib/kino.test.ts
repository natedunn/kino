import { describe, expect, it } from 'vitest';

import { normalizeOrgSlug } from './kino';

describe('normalizeOrgSlug', () => {
  it('preserves plain org slugs', () => {
    expect(normalizeOrgSlug('hello')).toBe('hello');
  });

  it('strips route-style leading @ prefixes', () => {
    expect(normalizeOrgSlug('@hello')).toBe('hello');
    expect(normalizeOrgSlug('@@hello')).toBe('hello');
  });
});
