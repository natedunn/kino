import type { AppAuthResult } from '@/lib/auth/auth-client';

import { ConvexHttpClient } from 'convex/browser';
import { ConvexError } from 'convex/values';

import { api } from '../../../../convex/native/_generated/api';
import { adoptNativeSession } from './native-client';

const proxy = new ConvexHttpClient('/api/auth/signin?path=', {
	skipConvexDeploymentUrlCheck: true,
});
const direct = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

function errorResult(error: unknown): AppAuthResult {
	let code: string | undefined;
	if (error instanceof ConvexError) {
		const data = error.data;
		code = typeof data === 'string' ? data : undefined;
	} else if (error && typeof error === 'object') {
		const candidate = error as { code?: unknown; message?: unknown };
		code = typeof candidate.code === 'string' ? candidate.code : undefined;
		if (!code && typeof candidate.message === 'string') code = candidate.message;
	}
	return { error: { ...(code ? { code } : {}), message: 'Native authentication failed' } };
}

function providerResult(result: { status: string; userError?: { error: string } }): AppAuthResult {
	return result.status === 'error'
		? { error: { code: result.userError?.error, message: 'Native authentication refused' } }
		: { error: null };
}

export async function nativeSignInWithPassword(input: { email: string; password: string }) {
	try {
		const result = await proxy.mutation(api.password.signIn, {
			email: input.email,
			password: input.password,
		});
		if (result.status === 'error') return providerResult(result);
		await adoptNativeSession(result.tokens);
		return { error: null };
	} catch (error) {
		return errorResult(error);
	}
}

export async function nativeSignUpWithPassword(input: {
	email: string;
	locale: 'en-US' | 'es-419' | 'zh-Hans';
	name: string;
	password: string;
}) {
	try {
		return providerResult(await direct.mutation(api.password.signUp, input));
	} catch (error) {
		return errorResult(error);
	}
}

export async function nativeRequestEmail(input: { email: string; purpose: 'verify' | 'reset' }) {
	try {
		return providerResult(await direct.mutation(api.password.requestEmail, input));
	} catch (error) {
		return errorResult(error);
	}
}

export async function nativeVerifyEmail(code: string) {
	try {
		const result = await proxy.mutation(api.password.verifyEmail, { code });
		await adoptNativeSession(result.tokens);
		return { error: null };
	} catch (error) {
		return errorResult(error);
	}
}

export async function nativeResetPassword(code: string, password: string) {
	try {
		return providerResult(await direct.mutation(api.password.resetPassword, { code, password }));
	} catch (error) {
		return errorResult(error);
	}
}

export async function nativeSignInWithGithub(callbackURL: string): Promise<AppAuthResult> {
	try {
		const response = await fetch('/api/auth/github/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ callbackURL }),
		});
		if (!response.ok) return { error: { code: 'GITHUB_START_FAILED' } };
		const result = (await response.json()) as { redirect?: unknown };
		if (typeof result.redirect !== 'string') return { error: { code: 'GITHUB_START_FAILED' } };
		window.location.assign(result.redirect);
		return { error: null };
	} catch (error) {
		return errorResult(error);
	}
}
