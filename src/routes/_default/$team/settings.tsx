import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/$team/settings')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/$team/settings"!</div>;
}
