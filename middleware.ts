import type { NextRequest } from 'next/server';

import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse } from 'next/server';

const authGuardUrls = ['/admin', '/authed'];

export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);

	// This simply enables the `request=false` query param to bypass the auth guard
	const bypassAuthGuard =
		request.nextUrl.searchParams.get('redirect') === 'false' &&
		authGuardUrls.includes(request.nextUrl.pathname);

	//
	// Auth Guard — passes redirect searchParam to sign-in page
	if (!sessionCookie && authGuardUrls.includes(request.nextUrl.pathname) && !bypassAuthGuard) {
		return NextResponse.redirect(
			new URL(`/sign-in?redirectTo=${request.nextUrl.pathname}`, request.url)
		);
	}

	// Continue
	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!api|_next|.*\\..*|favicon.ico|robots.txt|sitemap.xml|static).*)'],
};
