import type { SearchParams } from 'nuqs/server';

import React from 'react';
import { redirect } from 'next/navigation';

import { api } from '@/kit/api/fetcher/invoker';
import { getAuth } from '@/kit/auth';
import { exampleSearchParams } from '@/lib/params/search-params';

type PageProps = {
	searchParams: Promise<SearchParams>;
};

export default async function HomePage({ searchParams }: PageProps) {
	const { exampleString, redirect: redirectIfNotAuthed } = await exampleSearchParams(searchParams);
	const { user } = await getAuth();

	if (!user && redirectIfNotAuthed) {
		redirect('/sign-in');
	}

	const data = await api.example.authed(exampleString);

	return (
		<React.Fragment>
			<div className='space-y-6'>
				<h1 className='text-3xl font-bold'>Authed Procedure</h1>
				<p className='mt-2'>
					Below is returned data from the authed procedure. It only returns said data if you (the
					user) are authenticated.
				</p>
				<p>
					You may pass a search param of <span className='code'>redirect=false</span> to see the
					unauthenticated API error.
				</p>
			</div>
			<pre className='mt-6 code code-box'>
				<code>{JSON.stringify(data, null, 2)}</code>
			</pre>
		</React.Fragment>
	);
}
