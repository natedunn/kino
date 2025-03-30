import type { SearchParams } from 'nuqs/server';

import { api } from '@/kit/api/fetcher/server';
import { exampleSearchParams } from '@/lib/params/search-params';

type OpenFetcherProps = {
	searchParams: Promise<SearchParams>;
};

export const OpenFetcher = async ({ searchParams }: OpenFetcherProps) => {
	const { exampleString } = await exampleSearchParams(searchParams);
	const data = await api.example.open.query(exampleString);
	return JSON.stringify(data, null, 2);
};
