import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/chat/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>General</div>;
}
