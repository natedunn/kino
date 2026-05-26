import { useQuery } from '@tanstack/react-query';
import { Navigate, createFileRoute, useRouterState } from '@tanstack/react-router';

import { authClient } from '@/lib/convex/auth-client';
import { useCRPC } from '@/lib/convex/crpc';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  const crpc = useCRPC();
  const session = authClient.useSession();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const profileQuery = useQuery(
    crpc.profile.findMyProfile.queryOptions({}, { enabled: !!session.data?.user })
  );
  const orgsQuery = useQuery(
    crpc.org.findMyOrgs.queryOptions({}, { enabled: !!session.data?.user })
  );
  if (session.isPending) {
    return null;
  }

  if (!session.data?.user) {
    return <Navigate search={{ redirect: pathname }} to="/auth" />;
  }

  const user = profileQuery.data;
  const orgs = orgsQuery.data?.teams;

  return (
    <div>
      <h1>Hello, {user?.name}</h1>
      <div>Below are a list of teams you are a part of.</div>
      {!orgs?.length ? (
        <div>No orgs found.</div>
      ) : (
        orgs.map((org) => {
          return (
            <div key={org.id}>
              <span>{org.name}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
