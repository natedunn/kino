import { createFileRoute, notFound } from '@tanstack/react-router';

import { crpcServer } from '@/lib/convex/crpc-server';

import { FileExplorer, validateFileExplorerSearch } from '../../-components/file-explorer';

export const Route = createFileRoute('/@{$org}/$project/files/folder/$folderId/')({
	component: FolderFilesExplorer,
	loader: async ({ context, params }) => {
		const projectData = await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({ orgSlug: params.org, slug: params.project })
		);
		if (!projectData?.project) throw notFound();
	},
	validateSearch: validateFileExplorerSearch,
});

function FolderFilesExplorer() {
	const params = Route.useParams();
	return (
		<FileExplorer
			folderId={params.folderId}
			params={{ org: params.org, project: params.project }}
			search={Route.useSearch()}
		/>
	);
}
