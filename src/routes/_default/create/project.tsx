import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/create/project')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/create/project"!</div>;
}
