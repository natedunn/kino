import { createFileRoute } from '@tanstack/react-router';

import { FileExplorer, validateFileExplorerSearch } from './-components/file-explorer';

export const Route = createFileRoute('/@{$org}/$project/files/')({
	component: RootFilesExplorer,
	validateSearch: validateFileExplorerSearch,
});

function RootFilesExplorer() {
	return <FileExplorer folderId={null} params={Route.useParams()} search={Route.useSearch()} />;
}
