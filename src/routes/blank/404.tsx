import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/blank/404')({
	component: RouteComponent,
	loader: async () => {
		notFound({
			throw: true,
		})
	},
});

function RouteComponent() {
	return <div>Not found redirecting...</div>;
}
