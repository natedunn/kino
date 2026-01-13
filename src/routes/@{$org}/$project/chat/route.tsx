import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/chat')({
	component: RouteComponent,
});

function RouteComponent() {
	const { org, project } = Route.useParams();

	return (
		<div className='container h-full'>
			{org} , {project}
			{/* <SecondaryMenuLayout
				title='Channels'
				items={[
					{
						to: '/@{$org}/$project/chat/$chatId',
						params: {
							org,
							project,
							chatId: 'general',
						},
						children: 'General',
						icon: '✨',
					},
					{
						to: '/@{$org}/$project/chat/$chatId',
						params: {
							org,
							project,
							chatId: 'stack',
						},
						children: 'Stack',
						icon: '⚙️',
					},
					{
						to: '/@{$org}/$project/chat/$chatId',
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
			</SecondaryMenuLayout> */}
		</div>
	)
}
