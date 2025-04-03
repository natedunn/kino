import React from 'react';
import { ThemeProvider } from 'next-themes';
import * as H from 'next/headers';
import { NuqsAdapter as NuqsProvider } from 'nuqs/adapters/next/app';

import { Toaster } from '@/components/ui/sonner';
import { ApiProvider } from '@/kit/api/api-provider';

export default async function Providers({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const headers = new Headers(await H.headers());

	return (
		<React.Fragment>
			<NuqsProvider>
				<ThemeProvider attribute='class' defaultTheme='system'>
					<ApiProvider headers={headers}>{children}</ApiProvider>
				</ThemeProvider>
			</NuqsProvider>
			<Toaster />
		</React.Fragment>
	);
}
