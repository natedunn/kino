import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/discussions/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/@{$org}/$project/discussions/"!</div>;
}
