import { describe, expect, it } from 'vitest';

import { rewriteAuthRedirectLocation } from './auth-server';

describe('rewriteAuthRedirectLocation', () => {
  it('rewrites convex auth redirects onto the current app origin', () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: 'https://scrupulous-lemming-700.convex.site',
        location:
          'https://scrupulous-lemming-700.convex.site/api/auth/oauth-proxy-callback?callbackURL=http%3A%2F%2Flocalhost%3A3000%2F',
        requestUrl: 'http://localhost:3000/api/auth/callback/github?code=abc',
      })
    ).toBe(
      'http://localhost:3000/api/auth/oauth-proxy-callback?callbackURL=http%3A%2F%2Flocalhost%3A3000%2F'
    );
  });

  it('leaves non-convex redirects alone', () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: 'https://scrupulous-lemming-700.convex.site',
        location: 'https://github.com/login/oauth/authorize?state=abc',
        requestUrl: 'http://localhost:3000/api/auth/sign-in/social',
      })
    ).toBe('https://github.com/login/oauth/authorize?state=abc');
  });

  it('leaves non-auth convex redirects alone', () => {
    expect(
      rewriteAuthRedirectLocation({
        convexSiteUrl: 'https://scrupulous-lemming-700.convex.site',
        location: 'https://scrupulous-lemming-700.convex.site/somewhere-else',
        requestUrl: 'http://localhost:3000/api/auth/callback/github',
      })
    ).toBe('https://scrupulous-lemming-700.convex.site/somewhere-else');
  });
});
