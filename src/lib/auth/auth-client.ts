import { useMemo } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';

import {
	nativeRequestEmail,
	nativeResetPassword,
	nativeSignInWithGithub,
	nativeSignInWithPassword,
	nativeSignUpWithPassword,
	nativeVerifyEmail,
} from '@/lib/auth/adapters/native-actions';
import { signOutNativeSession } from '@/lib/auth/adapters/native-client';
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

export function useAuthSession(): { isPending: boolean; user: AppAuthUser | null } {
	const auth = useConvexAuth();
	const profile = useQuery(nativeApi.profiles.me, auth.isAuthenticated ? {} : 'skip');
	return useMemo(
		() => ({
			isPending: auth.isLoading || (auth.isAuthenticated && profile === undefined),
			user: profile
				? {
						email: profile.email,
						id: profile.id,
						image: profile.imageUrl,
						name: profile.name,
					}
				: null,
		}),
		[auth.isAuthenticated, auth.isLoading, profile]
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
