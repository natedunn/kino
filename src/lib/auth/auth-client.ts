import { useMemo } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import {
	nativeRequestEmail,
	nativeResetPassword,
	nativeSignInWithGithub,
	nativeSignInWithPassword,
	nativeSignUpWithPassword,
	nativeVerifyEmail,
} from '@/lib/auth/adapters/native-actions';
import { signOutNativeSession } from '@/lib/auth/adapters/native-client';
import { deriveViewerSignedIn } from '@/lib/auth/auth-snapshot';
import { getLocale } from '@/paraglide/runtime.js';

import { api as nativeApi } from '../../../convex/native/_generated/api';

export type AppAuthError = {
	code?: string;
	message?: string;
	status?: number;
};

export type AppAuthResult = {
	error: AppAuthError | null;
};

export type AppAuthUser = {
	email: string;
	id: string;
	image?: string | null;
	name: string;
};

export function useAuthState() {
	const auth = useConvexAuth();
	return { ...auth, hasSession: auth.isAuthenticated };
}

export function useIsAuthenticated() {
	return useConvexAuth().isAuthenticated;
}

const rootRoute = getRouteApi('__root__');

/**
 * The signed-in viewer. Until the Convex auth handshake settles, trust the
 * session the server validated for this request and read the profile the root
 * `beforeLoad` prefetched, so SSR and the first client render already show the
 * signed-in UI instead of flashing signed-out states after every hard load.
 */
export function useAuthSession(): { isPending: boolean; user: AppAuthUser | null } {
	const auth = useConvexAuth();
	const { loaderToken } = rootRoute.useLoaderData();
	const signedIn = deriveViewerSignedIn(auth, !!loaderToken);
	const { data: profile, isPending: profilePending } = useQuery(
		convexQuery(nativeApi.profiles.me, signedIn ? {} : 'skip')
	);
	return useMemo(
		() => ({
			isPending: signedIn && profilePending,
			user: profile
				? {
						email: profile.email,
						id: profile.id,
						image: profile.imageUrl,
						name: profile.name,
					}
				: null,
		}),
		[signedIn, profilePending, profile]
	);
}

export async function signInWithGitHub(callbackURL: string): Promise<AppAuthResult> {
	return nativeSignInWithGithub(callbackURL);
}

export async function signInWithPassword(input: {
	callbackURL: string;
	email: string;
	password: string;
}): Promise<AppAuthResult> {
	return nativeSignInWithPassword({ email: input.email, password: input.password });
}

export async function signUpWithPassword(input: {
	callbackURL: string;
	email: string;
	name: string;
	password: string;
}): Promise<AppAuthResult> {
	return nativeSignUpWithPassword({
		email: input.email,
		locale: getLocale(),
		name: input.name,
		password: input.password,
	});
}

export async function resendVerificationEmail(input: {
	callbackURL: string;
	email: string;
}): Promise<AppAuthResult> {
	return nativeRequestEmail({ email: input.email, purpose: 'verify' });
}

export async function requestPasswordReset(input: {
	email: string;
	redirectTo: string;
}): Promise<AppAuthResult> {
	return nativeRequestEmail({ email: input.email, purpose: 'reset' });
}

export async function resetPassword(input: {
	newPassword: string;
	token: string;
}): Promise<AppAuthResult> {
	return nativeResetPassword(input.token, input.newPassword);
}

export async function verifyEmail(code: string): Promise<AppAuthResult> {
	return nativeVerifyEmail(code);
}

export function useSignOutMutationOptions() {
	return { mutationFn: signOutNativeSession };
}
