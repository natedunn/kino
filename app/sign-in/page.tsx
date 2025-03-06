import type { SearchParams } from 'nuqs/server';

import React from 'react';
import { redirect } from 'next/navigation';

import { getAuth } from '@/kit/auth';
import { signInSearchParams } from '@/lib/params/search-params';

import { GithubButton } from './_components/github-button';

type PageProps = {
	searchParams: Promise<SearchParams>;
};

export default async function SignInPage({ searchParams }: PageProps) {
	const { session } = await getAuth();

	const { redirectTo } = await signInSearchParams(searchParams);

	if (session && redirectTo) {
		redirect(redirectTo);
	}

	return (
		<React.Fragment>
			<div className='space-y-6'>
				<h1 className='text-3xl font-bold'>Sign In</h1>
				<p className='mt-2'>Sign in to see authenticated features.</p>
				{redirectTo && (
					<p>
						You will be redirected to <span className='code'>{redirectTo}</span> after
						authentication.
					</p>
				)}
			</div>
			<div className='mt-6 font-mono font-bold bg-muted p-3 md:p-6 border'>
				<div className='flex flex-col gap-4'>
					<GithubButton disabled={!!session} redirectTo={redirectTo} />
				</div>
			</div>
		</React.Fragment>
	);
}
