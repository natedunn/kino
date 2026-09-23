import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/asset-library/$fileId/')({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: '/@{$org}/$project/files/file/$fileId',
			params,
			replace: true,
		});
	},
});
