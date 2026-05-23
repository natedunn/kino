import { createFileRoute } from '@tanstack/react-router';

import Folder from '@/icons/folder';

export const Route = createFileRoute('/@{$org}/$project/files/')({
  component: PlaceholderPage,
});

function PlaceholderPage() {
  return (
    <div className="container py-10">
      <div className="flex items-start gap-3 border-b pb-6">
        <Folder className="mt-1 text-muted-foreground" size="28px" />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Files</h1>
          <p className="text-muted-foreground">This area remained a placeholder in the previous app.</p>
        </div>
      </div>
    </div>
  );
}
