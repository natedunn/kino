import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { env } from './lib/env/shared';
import { getValidSubdomain } from './lib/utils/get-valid-subdomain';

// const authGuardUrls = ['/console'];

export async function middleware(req: NextRequest) {
	const url = req.nextUrl;

	let hostname = (req.headers.get('x-forwarded-host') || req.headers.get('host'))!.replace(
		'.localhost:3000',
		`.${env.NEXT_PUBLIC_ROOT_DOMAIN}`
	);

	// Special case for Vercel preview deployment URLs
	if (
		hostname.includes('---') &&
		hostname.endsWith(`.${process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_SUFFIX}`)
	) {
		hostname = `${hostname.split('---')[0]}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`;
	}

	const searchParams = req.nextUrl.searchParams.toString();
	// Get the pathname of the request (e.g. /, /about, /acme/feedback)
	const path = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''}`;

	if (hostname === `admin.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`) {
		return NextResponse.rewrite(new URL(`/admin${path === '/' ? '' : path}`, req.url));
	}

	// if (path.includes('/api')) {
	// 	const subdomain = !getValidSubdomain(hostname);
	// 	console.log('subdomain with path >>>>>>>>>', hostname, getValidSubdomain(hostname));
	// 	if (subdomain) {
	// 		return NextResponse.redirect(new URL(`${hostname}${path}`, req.url));
	// 	}
	// 	return NextResponse.next();
	// }

	if (hostname === 'localhost:3000' || hostname === process.env.NEXT_PUBLIC_ROOT_DOMAIN) {
		// rewrite root application to `/home` folder
		return NextResponse.rewrite(new URL(`/home${path === '/' ? '' : path}`, req.url));
	}

	//
	// Auth Guard — passes redirect searchParam to sign-in page
	// const sessionCookie = getSessionCookie(req);
	// if (!sessionCookie && authGuardUrls.includes(req.nextUrl.pathname)) {
	// 	return NextResponse.redirect(new URL(`/sign-in?redirectTo=${req.nextUrl.pathname}`, req.url));
	// }

	// Continue
	// return NextResponse.next();

	return NextResponse.rewrite(new URL(`/${hostname}${path}`, req.url));
}

export const config = {
	matcher: ['/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)'],
	// matcher: ['/((?!_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)'],
};
