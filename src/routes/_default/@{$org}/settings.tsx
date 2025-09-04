import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/@{$org}/settings')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/@$org/settings"!</div>;
}
