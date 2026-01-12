import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/updates/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div></div>;
}
