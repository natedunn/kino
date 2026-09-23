import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/asset-library/')({
	beforeLoad: ({ params }) => {
		throw redirect({ to: '/@{$org}/$project/files', params, replace: true });
	},
});
