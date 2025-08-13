import { createFileRoute, Outlet } from '@tanstack/react-router';

import { SecondaryMenuLayout } from '../-components/secondary-menu-layout';

export const Route = createFileRoute('/_default/$team/$project/chat')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team, project } = Route.useParams();

	return (
		<SecondaryMenuLayout
			title='Channels'
			items={[
				{
					to: '/$team/$project/chat/$chatId',
					params: {
						team,
						project,
						chatId: 'general',
					},
					children: 'General',
					icon: '✨',
				},
				{
					to: '/$team/$project/chat/$chatId',
					params: {
						team,
						project,
						chatId: 'stack',
					},
					children: 'Stack',
					icon: '⚙️',
				},
				{
					to: '/$team/$project/chat/$chatId',
					params: {
						team,
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
