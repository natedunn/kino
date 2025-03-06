'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { authClient } from '@/kit/auth/client';
import { getBaseUrl } from '@/kit/utils';

export const GithubButton = ({
	disabled = false,
	redirectTo,
}: {
	disabled?: boolean;
	redirectTo?: string | null;
}) => {
	const [loading, setLoading] = React.useState(false);
	const { signIn } = authClient;

	return (
		<Button
			onClick={async () => {
				setLoading(true);
				await signIn.social({
					provider: 'github',
					callbackURL: `${getBaseUrl({
						relativePath: false,
					})}${redirectTo ?? ''}`,
				});
			}}
			disabled={disabled}
		>
			{disabled ? 'You are already signed in' : loading ? 'Signing in...' : 'Sign in with Github'}
		</Button>
	);
};
