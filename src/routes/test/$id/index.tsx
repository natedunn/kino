import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/test/$id/')({
	// loader: () => {
	// 	throw notFound();
	// },
	component: RouteComponent,
	// notFoundComponent: () => {
	// 	return <div>Not found: index.tsx</div>;
	// },
});

function RouteComponent() {
	return <div>Hello "/test/"!</div>;
}
