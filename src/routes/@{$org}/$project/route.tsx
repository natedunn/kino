import { useState } from 'react';
import { Outlet, createFileRoute } from '@tanstack/react-router';

import { NotFound } from '@/components/_not-found';
import { cn } from '@/lib/utils';

import { DynamicNavigation } from './-components/dynamic-nav';

export const Route = createFileRoute('/@{$org}/$project')({
  component: ProjectRoute,
  notFoundComponent: () => (
    <div className="container">
      <NotFound />
    </div>
  ),
});

function ProjectRoute() {
  const { org: orgSlug, project: projectSlug } = Route.useParams();
  const [navCalculated, setNavCalculated] = useState(false);

  return (
    <div className={cn('flex flex-1 flex-col', !navCalculated && 'overflow-x-hidden')}>
      <div className="border-b bg-absolute">
        <DynamicNavigation
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          onStateChange={(state) => setNavCalculated(!state.isCalculating)}
        />
      </div>
      <Outlet />
    </div>
  );
}
