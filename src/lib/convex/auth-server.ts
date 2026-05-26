import { convexBetterAuthReactStart } from 'kitcn/auth/start';

function getAuth() {
  return convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL!,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
  });
}

export function rewriteAuthRedirectLocation({
  convexSiteUrl,
  location,
  requestUrl,
}: {
  convexSiteUrl: string;
  location: string;
  requestUrl: string;
}) {
  try {
    const request = new URL(requestUrl);
    const target = new URL(location, request);
    const convexSite = new URL(convexSiteUrl);

    if (target.origin !== convexSite.origin) {
      return location;
    }

    if (!target.pathname.startsWith('/api/auth/')) {
      return location;
    }

    target.protocol = request.protocol;
    target.host = request.host;

    return target.toString();
  } catch {
    return location;
  }
}

export async function handler(request: Request) {
  const response = await getAuth().handler(request);
  const location = response.headers.get('location');

  if (!location) {
    return response;
  }

  const rewrittenLocation = rewriteAuthRedirectLocation({
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
    location,
    requestUrl: request.url,
  });

  if (rewrittenLocation === location) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('location', rewrittenLocation);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

type AuthHelpers = ReturnType<typeof getAuth>;

export const getToken: AuthHelpers['getToken'] = (() => getAuth().getToken()) as AuthHelpers['getToken'];

export const fetchAuthQuery: AuthHelpers['fetchAuthQuery'] = ((...args: any[]) =>
  (getAuth().fetchAuthQuery as any).apply(getAuth(), args)) as AuthHelpers['fetchAuthQuery'];

export const fetchAuthMutation: AuthHelpers['fetchAuthMutation'] = ((...args: any[]) =>
  (getAuth().fetchAuthMutation as any).apply(getAuth(), args)) as AuthHelpers['fetchAuthMutation'];

export const fetchAuthAction: AuthHelpers['fetchAuthAction'] = ((...args: any[]) =>
  (getAuth().fetchAuthAction as any).apply(getAuth(), args)) as AuthHelpers['fetchAuthAction'];
