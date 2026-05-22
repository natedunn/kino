import { createFileRoute } from '@tanstack/react-router';

import Interview from '@/icons/interview';

export const Route = createFileRoute('/@{$org}/$project/discussions/')({
  component: PlaceholderPage,
});

function PlaceholderPage() {
  return (
    <div className="container py-10">
      <div className="flex items-start gap-3 border-b pb-6">
        <Interview className="mt-1 text-muted-foreground" size="28px" />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Discussions</h1>
          <p className="text-muted-foreground">This area remained a placeholder in the previous app.</p>
        </div>
      </div>
    </div>
  );
}
