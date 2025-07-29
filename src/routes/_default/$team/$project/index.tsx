import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_default/$team/$project/')({
	component: RouteComponent,
});

function RouteComponent() {
	const { team, project } = Route.useParams();

	return (
		<h1 className='text-2xl font-bold'>
			Project page: {team}/{project}
		</h1>
	);
}
