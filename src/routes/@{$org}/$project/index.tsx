import { Navigate, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/')({
  component: ProjectIndexRoute,
});

function ProjectIndexRoute() {
  const params = Route.useParams();
  return <Navigate params={params} to="/@{$org}/$project/feedback" />;
}
