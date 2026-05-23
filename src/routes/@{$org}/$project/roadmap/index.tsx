import { createFileRoute } from '@tanstack/react-router';

import Roadmap from '@/icons/roadmap';

export const Route = createFileRoute('/@{$org}/$project/roadmap/')({
  component: PlaceholderPage,
});

function PlaceholderPage() {
  return (
    <div className="container py-10">
      <div className="flex items-start gap-3 border-b pb-6">
        <Roadmap className="mt-1 text-muted-foreground" size="28px" />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Roadmap</h1>
          <p className="text-muted-foreground">This area remained a placeholder in the previous app.</p>
        </div>
      </div>
    </div>
  );
}
