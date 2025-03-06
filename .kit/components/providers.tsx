import React from 'react';
import { ThemeProvider } from 'next-themes';
import * as H from 'next/headers';
import { NuqsAdapter as NuqsProvider } from 'nuqs/adapters/next/app';

import { ApiProvider } from '@/kit/api/api-provider';

export default async function Providers({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const headers = new Headers(await H.headers());

	return (
		<ThemeProvider attribute='class' defaultTheme='system'>
			<NuqsProvider>
				<ApiProvider headers={headers}>{children}</ApiProvider>
			</NuqsProvider>
		</ThemeProvider>
	);
}
