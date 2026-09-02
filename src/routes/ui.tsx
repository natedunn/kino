import { lazy, Suspense } from 'react';
import { ClientOnly, createFileRoute } from '@tanstack/react-router';

import { RoutePending } from '@/components/route-pending';
import { titleMeta } from '@/lib/seo';

type UiSearch = { item?: string };

const UiLibraryPage = lazy(() =>
	import('@/components/ui-lab/ui-library-page').then((module) => ({
		default: module.UiLibraryPage,
	}))
);

export const Route = createFileRoute('/ui')({
	head: () => ({
		meta: [titleMeta(['UI Library'])],
	}),
	ssr: false,
	validateSearch: (search: Record<string, unknown>): UiSearch => ({
		item: typeof search.item === 'string' ? search.item : undefined,
	}),
	component: UiLibraryPageRoute,
});

function UiLibraryPageRoute() {
	return (
		<ClientOnly fallback={<RoutePending variant='page' />}>
			<Suspense fallback={<RoutePending variant='page' />}>
				<UiLibraryPage />
			</Suspense>
		</ClientOnly>
	);
}
