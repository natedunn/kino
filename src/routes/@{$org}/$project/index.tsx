import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/')({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className='container'>
			<div>Hello "/_default/@$org/$project/"!</div>
		</div>
	)
}
