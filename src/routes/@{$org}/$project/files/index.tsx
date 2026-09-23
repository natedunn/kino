import { createFileRoute } from '@tanstack/react-router';

import { preloadNativeFiles } from '@/lib/convex/native-files';

import { FileExplorer, validateFileExplorerSearch } from './-components/file-explorer';

export const Route = createFileRoute('/@{$org}/$project/files/')({
	component: RootFilesExplorer,
	loaderDeps: ({ search }) => search,
	loader: ({ context, params, deps }) => preloadNativeFiles(context.queryClient, params, deps),
	validateSearch: validateFileExplorerSearch,
});

function RootFilesExplorer() {
	return <FileExplorer folderId={null} params={Route.useParams()} search={Route.useSearch()} />;
}
