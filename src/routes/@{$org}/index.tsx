import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight, CircleCheck, FolderOpen, Settings, User } from 'lucide-react';

import { EmptyState, Panel } from '@/components/kino/common';
import { NoPublicProjects } from './-components/no-public-projects';
import { OrgProjects } from './-components/org-projects';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useCRPC } from '@/lib/convex/crpc';

export const Route = createFileRoute('/@{$org}/')({
  component: OrganizationRoute,
});

function OrganizationRoute() {
  const params = Route.useParams();
  const crpc = useCRPC();
  const orgQuery = useQuery(
    crpc.org.getDetails.queryOptions({
      slug: params.org,
    })
  );
  const projectsQuery = useQuery(
    crpc.project.getManyByOrg.queryOptions({
      limit: 24,
      orgSlug: params.org,
    })
  );
  const limitsQuery = useQuery(
    crpc.org.getMyPermission.queryOptions(
      { slug: params.org },
      { enabled: !!orgQuery.data?.permissions.canEdit }
    )
  );

  if (orgQuery.isLoading) {
    return (
      <div className="container py-10">
        <Panel className="h-56 animate-pulse bg-muted/40" />
      </div>
    );
  }

  const orgData = orgQuery.data;
  const projects = projectsQuery.data ?? [];

  if (!orgData?.org) {
    return (
      <div className="container py-10">
        <EmptyState
          title="Organization not available"
          description="This organization either does not exist or your session cannot view it."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b bg-muted/50">
        <div className="container pt-12 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 border md:size-12">
                <AvatarFallback className="text-lg font-bold">
                  {orgData.org.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-2xl font-bold md:text-3xl">{orgData.org.name}</h1>
            </div>
            {orgData.permissions.canEdit ? (
              <Button asChild variant="outline">
                <Link params={params} to="/@{$org}/edit">
                  <Settings />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="container">
        <div className="mt-6 flex items-center gap-4">
          {projects.length === 0 ? (
            <NoPublicProjects
              canEdit={orgData.permissions.canEdit}
              orgName={orgData.org.name}
              orgSlug={params.org}
            />
          ) : (
            <div className="w-full">
              <div className="flex flex-col justify-stretch gap-6 md:flex-row">
                <div className="inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6">
                  <div className="flex items-center gap-2">
                    <User className="size-7" />
                    <span className="text-gradient-primary text-3xl font-bold">7</span>
                  </div>
                  <span className="text-muted-foreground">members</span>
                </div>
                <div className="inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6">
                  <div className="flex items-center gap-2">
                    <CircleCheck className="size-7" />
                    <span className="text-gradient-primary text-3xl font-bold">126</span>
                  </div>
                  <span className="text-muted-foreground">closed items this month</span>
                </div>
                <div className="inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-7" />
                    <span className="text-gradient-primary text-3xl font-bold">{projects.length}</span>
                  </div>
                  <span className="text-muted-foreground">active projects</span>
                </div>
                <div className="inline-flex flex-auto flex-col gap-2 rounded-lg border bg-muted p-6">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="size-7" />
                  </div>
                  <span>see all stats</span>
                </div>
              </div>
              <div className="mt-12 grid w-full grid-cols-1 gap-12 md:grid-cols-12">
                <div className="col-span-1 md:col-span-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold">Projects</h3>
                    {orgData.permissions.canEdit && limitsQuery.data?.canAddProjects ? (
                      <Link
                        className="link-text"
                        params={{ org: params.org }}
                        to="/@{$org}/create-project"
                      >
                        Create a new project
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-5">
                    <OrgProjects orgSlug={params.org} projects={projects} />
                  </div>
                </div>
                <div className="col-span-1 md:col-span-4">
                  <h3 className="text-2xl font-bold">Members</h3>
                  <div className="mt-5">Members will go here</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
