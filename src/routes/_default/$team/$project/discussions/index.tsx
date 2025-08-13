import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/$team/$project/discussions/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/$team/$project/discussions/"!</div>;
}
