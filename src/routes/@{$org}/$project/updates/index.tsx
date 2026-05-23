import type { ReactNode } from 'react';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { z } from 'zod';

import { RoutePending } from '@/components/route-pending';
import { Button } from '@/components/ui/button';
import CalendarDays from '@/icons/calendar-days';
import CirclePlusOutline from '@/icons/circle-plus-outline';
import Missing from '@/icons/missing';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcOptions } from '@/lib/convex/crpc-options';
import { preloadCRPCQuery } from '@/lib/convex/preload';
import { api } from '@convex/api';

import { CategoriesNav } from './-components/categories-nav';
import { UpdateCard } from './-components/update-card';

type ProjectDetailsData = {
  project?: {
    id: string;
  } | null;
};

const updatesSearchParams = z.object({
  category: z.optional(
    z.enum(['changelog', 'article', 'announcement']).transform((value) => (value?.trim() === '' ? undefined : value))
  ),
});

export const Route = createFileRoute('/@{$org}/$project/updates/')({
  component: UpdatesListRoute,
  loader: async ({ context, params }) => {
    const projectArgs = {
      orgSlug: params.org,
      slug: params.project,
    };
    const projectOptions = crpcOptions.project.getDetails.staticQueryOptions(projectArgs);
    const projectData = await preloadCRPCQuery<ProjectDetailsData, typeof projectArgs>(
      context.queryClient,
      projectOptions,
      api.project.getDetails,
      projectArgs
    );

    if (!projectData?.project?.id) {
      throw notFound();
    }

    const updatesArgs = {
      projectId: projectData.project.id,
    };
    const updatesOptions = crpcOptions.update.listByProject.staticQueryOptions(updatesArgs);
    await preloadCRPCQuery(context.queryClient, updatesOptions, api.update.listByProject, updatesArgs);
  },
  pendingComponent: () => <RoutePending variant="page" />,
  pendingMs: 150,
  validateSearch: updatesSearchParams,
});

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="text-bold flex items-center justify-center gap-3 rounded-lg border bg-muted p-4 text-xl text-muted-foreground md:p-10">
      <div>{icon}</div>
      <div>{children}</div>
    </div>
  );
}

function UpdatesListRoute() {
  const { org: orgSlug, project: projectSlug } = Route.useParams();
  const { category: categoryParam } = Route.useSearch();
  const crpc = useCRPC();

  const { data: projectData } = useSuspenseQuery(
    crpc.project.getDetails.queryOptions(
      {
        orgSlug,
        slug: projectSlug,
      }
    )
  );

  if (!projectData?.project) {
    throw notFound();
  }

  const updatesQuery = useSuspenseQuery(
    crpc.update.listByProject.queryOptions(
      {
        projectId: projectData.project.id,
      }
    )
  );
  const currentProfileQuery = useQuery(
    crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
  );

  const allUpdates = updatesQuery.data?.updates ?? [];
  const canEdit = updatesQuery.data?.canEdit ?? false;
  const updates = categoryParam
    ? allUpdates.filter((update) => update.category === categoryParam)
    : allUpdates;

  return (
    <div className="container h-full overflow-visible">
      <div className="h-full grid-cols-12 gap-8 md:grid">
        <div className="order-first border-l border-border/75 py-6 md:order-last md:col-span-3">
          <div className="sticky top-6 flex flex-col overflow-hidden">
            {canEdit ? (
              <div className="border-b pb-6 pl-6">
                <Button asChild className="w-full" size="lg">
                  <Link params={{ org: orgSlug, project: projectSlug }} to="/@{$org}/$project/updates/new">
                    <CirclePlusOutline size="16px" /> New Update
                  </Link>
                </Button>
              </div>
            ) : null}
            <div className={canEdit ? 'mt-4' : ''}>
              <div className="pb-6 pl-6">
                <h2 className="mx-2 text-sm font-bold text-muted-foreground">Categories</h2>
                <div className="mt-2">
                  <CategoriesNav />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 py-8 md:col-span-9" aria-busy={updatesQuery.isFetching} aria-live="polite">
          <div className="flex items-start gap-3 border-b pt-6 pb-6 md:-mr-8.25">
            <CalendarDays className="mt-1 text-muted-foreground" size="28px" />
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold">Updates</h1>
              <p className="text-muted-foreground">The latest news and announcements.</p>
            </div>
          </div>

          {updates.length === 0 ? (
            <Notice icon={<Missing aria-hidden="true" size="32px" />}>No updates yet.</Notice>
          ) : null}
          {updates.length > 0 ? (
            <ul className="flex flex-col">
              {updates.map((update, index) => (
                <UpdateCard
                  key={update.id}
                  currentProfileId={currentProfileQuery.data?.id}
                  isLast={index === updates.length - 1}
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  update={update}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
