import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/$team/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Public team page</div>;
}
