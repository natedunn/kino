import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/roadmap/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Roadmap</div>;
}
