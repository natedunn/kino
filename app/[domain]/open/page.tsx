import type { SearchParams } from 'nuqs/server';

import React from 'react';

import { api } from '@/kit/api/fetcher/invoker';
import { exampleSearchParams } from '@/lib/params/search-params';

type PageProps = {
	searchParams: Promise<SearchParams>;
};

export default async function HomePage({ searchParams }: PageProps) {
	const { exampleString } = await exampleSearchParams(searchParams);
	const data = await api.example.open(exampleString);
	return (
		<React.Fragment>
			<div className='space-y-6'>
				<h1 className='text-3xl font-bold'>Open Procedure</h1>
				<p className='mt-2'>
					Below is returned data from the open procedure. It does not require authentication or
					authorization. However, if you are authenticated it will still include your email.
				</p>
			</div>
			<pre className='mt-6 code code-box'>
				<code>{JSON.stringify(data, null, 2)}</code>
			</pre>
		</React.Fragment>
	);
}
