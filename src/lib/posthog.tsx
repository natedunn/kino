'use client';

import type { AppEnvironment } from '@/lib/app-env';
import type { PostHogConfig } from 'posthog-js';
import type { ReactNode } from 'react';

import { useEffect, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';

import { authClient } from '@/lib/convex/auth-client';

// NOTE: `phc_...` is PostHog's *public* project API key — it's a client-side,
// write-only token designed to be shipped in the browser bundle (like a GA
// measurement ID). It is NOT a secret and exposes nothing; it only ingests
// events and cannot read data. These hardcoded values are safe fallbacks so
// production analytics keep working even if the VITE_ env vars are missing at
// build time. Do NOT copy this "hardcoded fallback" pattern for real secrets
// (e.g. a `phx_...` personal key, DB URLs, or any server-side credential).
const DEFAULT_POSTHOG_TOKEN = 'phc_B9p4kmKAZEUCmiSPULzu8m3FYr4CWVyANuS5iqAeeoB';
const DEFAULT_POSTHOG_HOST = 'https://j.usekino.com';

function fromEnvOrDefault(value: string | undefined, fallback: string) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : fallback;
}

const POSTHOG_TOKEN = fromEnvOrDefault(
	import.meta.env.VITE_POSTHOG_PROJECT_TOKEN,
	DEFAULT_POSTHOG_TOKEN
);
const POSTHOG_HOST = fromEnvOrDefault(import.meta.env.VITE_POSTHOG_HOST, DEFAULT_POSTHOG_HOST);
type PostHogClient = typeof import('posthog-js').default;

function canUsePostHog(appEnvironment: AppEnvironment) {
	return (
		appEnvironment === 'production' &&
		typeof window !== 'undefined' &&
		!!POSTHOG_TOKEN &&
		!!POSTHOG_HOST
	);
}

function createPostHogOptions(): Partial<PostHogConfig> {
	return {
		api_host: POSTHOG_HOST,
		autocapture: false,
		capture_exceptions: true,
		capture_pageleave: true,
		capture_pageview: false,
		defaults: '2026-05-30',
		mask_all_element_attributes: true,
		mask_all_text: true,
		mask_personal_data_properties: true,
		person_profiles: 'identified_only',
		session_recording: {
			blockClass: 'ph-no-capture',
			blockSelector: '.ph-no-capture, [data-ph-no-capture], [data-sensitive]',
			maskAllInputs: true,
			maskInputOptions: {
				color: true,
				date: true,
				'datetime-local': true,
				email: true,
				month: true,
				number: true,
				password: true,
				range: true,
				search: true,
				select: true,
				tel: true,
				text: true,
				textarea: true,
				time: true,
				url: true,
				week: true,
			},
			maskTextSelector: '.ph-mask, [data-ph-mask], input, textarea, select, [contenteditable]',
		},
	};
}

let postHogClient: PostHogClient | null = null;
let postHogLoadPromise: Promise<PostHogClient | null> | null = null;

function hasInitializedPostHog() {
	return postHogClient !== null;
}

async function ensurePostHog(appEnvironment: AppEnvironment) {
	if (!canUsePostHog(appEnvironment)) return null;

	if (postHogClient) return postHogClient;
	if (postHogLoadPromise) return postHogLoadPromise;

	postHogLoadPromise = import('posthog-js')
		.then(({ default: posthog }) => {
			if (postHogClient) return postHogClient;

			const token = POSTHOG_TOKEN;
			if (!token) return null;

			posthog.init(token, createPostHogOptions());
			postHogClient = posthog;
			return posthog;
		})
		.catch(() => null);

	return postHogLoadPromise;
}

function usePostHogClient(appEnvironment: AppEnvironment) {
	const [client, setClient] = useState<PostHogClient | null>(() =>
		canUsePostHog(appEnvironment) ? postHogClient : null
	);

	useEffect(() => {
		let cancelled = false;

		void ensurePostHog(appEnvironment).then((nextClient) => {
			if (!cancelled) {
				setClient(nextClient);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [appEnvironment]);

	return client;
}

export function PostHogProvider({
	appEnvironment,
	children,
}: {
	appEnvironment: AppEnvironment;
	children: ReactNode;
}) {
	const client = usePostHogClient(appEnvironment);

	return (
		<>
			{client ? <PostHogRuntime client={client} /> : null}
			{children}
		</>
	);
}

function PostHogRuntime({ client }: { client: PostHogClient }) {
	return (
		<>
			<PostHogPageviewTracker client={client} />
			<PostHogIdentitySync client={client} />
		</>
	);
}

function PostHogPageviewTracker({ client }: { client: PostHogClient }) {
	const location = useRouterState({ select: (state) => state.location });

	useEffect(() => {
		const url = new URL(window.location.href);

		client.capture('$pageview', {
			$current_url: `${url.origin}${location.pathname}`,
			path: location.pathname,
		});
	}, [client, location.pathname, location.searchStr]);

	return null;
}

export function capturePostHogException(error: unknown, properties?: Record<string, unknown>) {
	if (!hasInitializedPostHog()) return;

	postHogClient?.captureException(error, properties);
}

export function capturePostHogEvent(eventName: string, properties?: Record<string, unknown>) {
	if (!hasInitializedPostHog()) return;

	postHogClient?.capture(eventName, properties);
}

export function captureAppError(error: unknown, properties?: Record<string, unknown>) {
	capturePostHogException(error, {
		appError: true,
		...properties,
	});
}

function PostHogIdentitySync({ client }: { client: PostHogClient }) {
	const session = authClient.useSession();
	const identifiedUserId = useRef<string | null>(null);

	useEffect(() => {
		if (session.isPending) return;

		const user = session.data?.user;

		if (!user) {
			if (identifiedUserId.current) {
				client.reset();
				identifiedUserId.current = null;
			}
			return;
		}

		if (identifiedUserId.current === user.id) return;

		client.identify(user.id, {
			email: user.email,
			name: user.name,
		});
		identifiedUserId.current = user.id;
	}, [client, session.data?.user, session.isPending]);

	return null;
}
