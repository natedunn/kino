import { createFileRoute, Outlet } from '@tanstack/react-router';

import { SecondaryMenuLayout } from '../-components/secondary-menu-layout';

export const Route = createFileRoute('/_default/$org/$project/chat')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org, project } = Route.useParams();

	return (
		<SecondaryMenuLayout
			title='Channels'
			items={[
				{
					to: '/$org/$project/chat/$chatId',
					params: {
						org,
						project,
						chatId: 'general',
					},
					children: 'General',
					icon: '✨',
				},
				{
					to: '/$org/$project/chat/$chatId',
					params: {
						org,
						project,
						chatId: 'stack',
					},
					children: 'Stack',
					icon: '⚙️',
				},
				{
					to: '/$org/$project/chat/$chatId',
					params: {
						org,
						project,
						chatId: 'off-topic',
					},
					children: 'Off-topic',
					icon: '👀',
				},
			]}
		>
			<Outlet />
		</SecondaryMenuLayout>
	);
}
