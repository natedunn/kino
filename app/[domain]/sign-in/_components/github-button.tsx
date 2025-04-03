'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { authClient } from '@/kit/auth/client';
import { getBaseUrl } from '@/kit/utils';
import { createURL } from '@/lib/utils/create-url';

// import { env } from '@/lib/env/shared';

export const GithubButton = ({
	disabled = false,
	redirectTo,
	subdomain,
}: {
	disabled?: boolean;
	redirectTo?: string | null;
	subdomain: string | null;
}) => {
	const [loading, setLoading] = React.useState(false);

	// const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
	// const protocol = rootDomain.includes('localhost') ? 'http://' : 'https://';
	// const base = `${protocol}${subdomain ? `${subdomain}.` : ''}${env.NEXT_PUBLIC_ROOT_DOMAIN}`;

	const base = getBaseUrl({
		relativePath: false,
		protocol: false,
		skipVercelUrl: true,
	});

	console.log('base', base);

	const callbackURL = createURL({
		domain: base,
		subdomain,
		path: redirectTo ?? '',
	});

	const fetchBaseUrl = createURL({
		domain: base,
		subdomain,
		path: '/api/auth',
	});

	if (!callbackURL || !fetchBaseUrl) {
		throw new Error('Invalid URL parameters');
	}

	// console.log('URL', callbackURL, fetchBaseUrl);

	return (
		<Button
			onClick={async () => {
				setLoading(true);

				const res = await authClient().signIn.social({
					provider: 'github',
					callbackURL,
					fetchOptions: {
						baseURL: fetchBaseUrl,
					},
				});

				if (res.error) {
					setLoading(false);
				}
			}}
			disabled={disabled}
		>
			{disabled ? 'You are already signed in' : loading ? 'Signing in...' : 'Sign in with Github'}
		</Button>
	);
};
