import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/$org/_default/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div></div>;
}
