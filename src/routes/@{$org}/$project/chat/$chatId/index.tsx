import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/chat/$chatId/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	return <div>Chat: ${chatId}</div>;
}
