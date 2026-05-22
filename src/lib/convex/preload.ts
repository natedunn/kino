import type { QueryClient } from '@tanstack/react-query';

type QueryOptionsLike = {
  queryKey: readonly unknown[];
};

export async function preloadCRPCQuery<TData, TArgs extends Record<string, unknown>>(
  queryClient: QueryClient,
  options: QueryOptionsLike,
  queryRef: unknown,
  args: TArgs
): Promise<TData> {
  const cached = queryClient.getQueryData<TData>(options.queryKey);

  if (cached !== undefined) {
    return cached;
  }

  if (import.meta.env.SSR) {
    const { fetchAuthQuery } = await import('@/lib/convex/auth-server');
    const data = (await fetchAuthQuery(queryRef as never, args as never)) as TData;
    queryClient.setQueryData(options.queryKey, data);
    return data;
  }

  return (await queryClient.ensureQueryData(options as never)) as TData;
}
