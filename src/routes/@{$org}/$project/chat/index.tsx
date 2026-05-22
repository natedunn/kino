import { createFileRoute } from '@tanstack/react-router';

import Chat from '@/icons/chat';

export const Route = createFileRoute('/@{$org}/$project/chat/')({
  component: PlaceholderPage,
});

function PlaceholderPage() {
  return (
    <div className="container py-10">
      <div className="flex items-start gap-3 border-b pb-6">
        <Chat className="mt-1 text-muted-foreground" size="28px" />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Chat</h1>
          <p className="text-muted-foreground">This area remained a placeholder in the previous app.</p>
        </div>
      </div>
    </div>
  );
}
