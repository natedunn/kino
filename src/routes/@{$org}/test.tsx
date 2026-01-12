import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/test')({
	component: RouteComponent,
	loader: () => {
		throw notFound();
	},
	notFoundComponent: () => {
		return <div>Not found: index.tsx</div>;
	},
});

function RouteComponent() {
	return <div>Hello "/@$org/$project/feedback/boards/test"!</div>;
}
