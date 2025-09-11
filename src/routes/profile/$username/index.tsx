import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/profile/$username/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_default/profile/$username/"!</div>;
}
