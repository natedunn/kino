'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { authClient } from '@/kit/auth/client';
import { env } from '@/lib/env/shared';

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

	const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
	const protocol = rootDomain.includes('localhost') ? 'http://' : 'https://';
	const base = `${protocol}${subdomain ? `${subdomain}.` : ''}${env.NEXT_PUBLIC_ROOT_DOMAIN}`;

	return (
		<Button
			onClick={async () => {
				setLoading(true);

				const res = await authClient.signIn.social({
					provider: 'github',
					callbackURL: `${base}${redirectTo ?? ''}`,
					fetchOptions: {
						baseURL: `${base}/api/auth`,
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
