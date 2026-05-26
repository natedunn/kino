import { convexBetterAuthReactStart } from 'kitcn/auth/start';

function createAuth() {
  return convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL!,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
  });
}

type AuthHelpers = ReturnType<typeof createAuth>;

let authSingleton: AuthHelpers | undefined;

function getAuth() {
  authSingleton ??= createAuth();
  return authSingleton;
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

type HeadersWithSetCookieList = Headers & {
  getSetCookie?: () => string[];
};

export function cloneHeadersPreservingSetCookie(source: Headers) {
  const headers = new Headers();

  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === 'set-cookie') continue;
    headers.append(key, value);
  }

  const getSetCookie = (source as HeadersWithSetCookieList).getSetCookie;
  if (typeof getSetCookie === 'function') {
    for (const value of getSetCookie.call(source)) {
      headers.append('set-cookie', value);
    }
    return headers;
  }

  const setCookie = source.get('set-cookie');
  if (setCookie) {
    headers.append('set-cookie', setCookie);
  }

  return headers;
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

  const headers = cloneHeadersPreservingSetCookie(response.headers);
  headers.set('location', rewrittenLocation);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export const getToken: AuthHelpers['getToken'] = () => getAuth().getToken();

export const fetchAuthQuery: AuthHelpers['fetchAuthQuery'] = (...args) => {
  return getAuth().fetchAuthQuery(...args);
};

export const fetchAuthMutation: AuthHelpers['fetchAuthMutation'] = (...args) => {
  return getAuth().fetchAuthMutation(...args);
};

export const fetchAuthAction: AuthHelpers['fetchAuthAction'] = (...args) => {
  return getAuth().fetchAuthAction(...args);
};
