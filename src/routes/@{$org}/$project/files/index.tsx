import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/files/')({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Files</div>;
}
