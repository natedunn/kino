'use client';

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/kit/api/fetcher/client';

export const AdminDataFetcher = () => {
	const trpc = useTRPC();
	const { data, status, error } = useQuery(
		trpc.example.listUsers.queryOptions(undefined, {
			retry: 0,
			refetchOnWindowFocus: false,
		})
	);

	if (status === 'error') {
		return <div>Error: {error.message}</div>;
	}

	if (status === 'pending') {
		return <div>Loading...</div>;
	}

	return <>{JSON.stringify(data, null, 2)}</>;
};
