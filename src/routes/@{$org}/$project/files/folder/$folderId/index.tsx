import { createFileRoute } from '@tanstack/react-router';

import { preloadNativeFiles } from '@/lib/convex/native-files';

import { FileExplorer, validateFileExplorerSearch } from '../../-components/file-explorer';

export const Route = createFileRoute('/@{$org}/$project/files/folder/$folderId/')({
	component: FolderFilesExplorer,
	loaderDeps: ({ search }) => search,
	loader: ({ context, params, deps }) => preloadNativeFiles(context.queryClient, params, deps),
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
