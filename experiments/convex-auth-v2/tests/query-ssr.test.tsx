import { Suspense } from 'react';
import { convexQuery, ConvexQueryClient } from '@convex-dev/react-query';
import {
	dehydrate,
	hydrate,
	QueryClient,
	QueryClientProvider,
	useSuspenseQuery,
} from '@tanstack/react-query';
import { makeFunctionReference } from 'convex/server';
import { renderToReadableStream } from 'react-dom/server.edge';
import { afterEach, expect, test, vi } from 'vitest';

const project = makeFunctionReference<'query', { slug: string }, { title: string }>('projects:get');
const clients: Array<{ query: QueryClient; convex: ConvexQueryClient }> = [];
function setup() {
	const convex = new ConvexQueryClient('https://proof.convex.cloud');
	const query = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convex.hashFn(),
				queryFn: convex.queryFn(),
				retry: false,
			},
		},
	});
	convex.connect(query);
	clients.push({ query, convex });
	return { query, convex };
}
afterEach(async () => {
	for (const client of clients.splice(0)) {
		client.query.clear();
		client.convex.unsubscribe?.();
		await client.convex.convexClient.close();
	}
});
function Project({ slug }: { slug: string }) {
	const { data } = useSuspenseQuery(convexQuery(project, { slug }));
	return <h1>{data.title}</h1>;
}
async function render(query: QueryClient, slug = 'kino') {
	const stream = await renderToReadableStream(
		<QueryClientProvider client={query}>
			<Suspense fallback={<p>Loading</p>}>
				<Project slug={slug} />
			</Suspense>
		</QueryClientProvider>
	);
	await stream.allReady;
	return new Response(stream).text();
}

test('loader prefetch and Suspense SSR reuse the official adapter query key', async () => {
	const { query, convex } = setup();
	// Only the backend transport is replaced. Query options/hash/queryFn and React
	// Suspense SSR are real. This is not a live subscription/browser hover test.
	const fetch = vi
		.spyOn(convex.serverHttpClient!, 'consistentQuery')
		.mockResolvedValue({ title: 'Kino' });
	await query.ensureQueryData(convexQuery(project, { slug: 'kino' }));
	expect(await render(query)).toContain('<h1>Kino</h1>');
	expect(fetch).toHaveBeenCalledTimes(1);
});

test('Suspense SSR fetches on a direct entry without loader prefetch', async () => {
	const { query, convex } = setup();
	const fetch = vi
		.spyOn(convex.serverHttpClient!, 'consistentQuery')
		.mockResolvedValue({ title: 'Direct entry' });
	expect(await render(query)).toContain('<h1>Direct entry</h1>');
	expect(fetch).toHaveBeenCalledTimes(1);
});

test('serialized successful query data can hydrate into a separate cache without another fetch', async () => {
	const server = setup();
	vi.spyOn(server.convex.serverHttpClient!, 'consistentQuery').mockResolvedValue({
		title: 'Hydrated',
	});
	await server.query.ensureQueryData(convexQuery(project, { slug: 'kino' }));
	const state = JSON.parse(JSON.stringify(dehydrate(server.query)));
	const next = setup();
	const fetch = vi
		.spyOn(next.convex.serverHttpClient!, 'consistentQuery')
		.mockRejectedValue(new Error('unexpected duplicate fetch'));
	hydrate(next.query, state);
	expect(await render(next.query)).toContain('<h1>Hydrated</h1>');
	expect(fetch).not.toHaveBeenCalled();
});

test('different arguments and different request caches never reuse another result', async () => {
	const a = setup();
	const b = setup();
	const fetchA = vi
		.spyOn(a.convex.serverHttpClient!, 'consistentQuery')
		.mockResolvedValue({ title: 'Alice private project' });
	const fetchB = vi
		.spyOn(b.convex.serverHttpClient!, 'consistentQuery')
		.mockResolvedValue({ title: 'Bob private project' });
	await a.query.ensureQueryData(convexQuery(project, { slug: 'kino' }));
	expect(b.query.getQueryData(convexQuery(project, { slug: 'kino' }).queryKey)).toBeUndefined();
	expect(a.query.getQueryData(convexQuery(project, { slug: 'other' }).queryKey)).toBeUndefined();
	expect(await render(b.query)).toContain('Bob private project');
	expect(fetchA).toHaveBeenCalledTimes(1);
	expect(fetchB).toHaveBeenCalledTimes(1);
});
