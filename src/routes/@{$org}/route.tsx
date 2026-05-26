import { useQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute } from '@tanstack/react-router';

import { DefaultCatchBoundary } from '@/components/_default-catch-boundary';
import { NotFound } from '@/components/_not-found';
import { RoutePending } from '@/components/route-pending';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcOptions } from '@/lib/convex/crpc-options';
import { fetchConvexLoaderQuery } from '@/lib/convex/server';

import { MainNav } from './-components/main-nav';

export const Route = createFileRoute('/@{$org}')({
  loader: async ({ context }) => {
    await fetchConvexLoaderQuery(
      context.queryClient,
      crpcOptions.profile.findMyProfile.staticQueryOptions(
        {},
        { skipUnauth: true }
      ),
      context.loaderToken
    );
  },
  component: OrganizationShell,
  notFoundComponent: () => <NotFound isContainer />,
  pendingComponent: () => <RoutePending variant="page" />,
  errorComponent: DefaultCatchBoundary,
});

function OrganizationShell() {
  const crpc = useCRPC();
  const profileQuery = useQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  );

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex w-full flex-1 flex-col">
        <MainNav user={profileQuery.data} />
        <Outlet />
      </div>
      <footer className="mt-auto w-full border-t border-border py-4 text-center text-sm text-muted-foreground">
        <div className="container">
          <p>© {new Date().getFullYear()} Kino</p>
        </div>
      </footer>
    </div>
  );
}
