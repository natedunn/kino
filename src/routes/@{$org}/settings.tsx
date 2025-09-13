import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/settings')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/@$org/settings"!</div>;
}
