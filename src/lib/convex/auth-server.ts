import { convexBetterAuthReactStart } from 'kitcn/auth/start';

const productionOrigin =
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://usekino.com';

export const {
  handler: kitcnAuthHandler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: import.meta.env.VITE_CONVEX_URL!,
  convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
});

export async function handler(request: Request) {
  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== productionOrigin) {
    return kitcnAuthHandler(request);
  }

  const headers = new Headers(request.headers);
  headers.set('x-skip-oauth-proxy', 'true');

  return kitcnAuthHandler(new Request(request, { headers }));
}
