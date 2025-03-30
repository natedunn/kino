import type { SearchParams } from 'nuqs/server';

import React, { Suspense } from 'react';

import { OpenFetcher } from './open-fetcher';

type PageProps = {
	searchParams: Promise<SearchParams>;
};

export default async function HomePage({ searchParams }: PageProps) {
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
				<code>
					<Suspense fallback={<div>Loading...</div>}>
						<OpenFetcher searchParams={searchParams} />
					</Suspense>
				</code>
			</pre>
		</React.Fragment>
	);
}
