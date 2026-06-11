import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/@{$org}/$project/roadmap/')({
  component: PlaceholderPage,
});

function PlaceholderPage() {
  return (
    <div className="container py-10">
    </div>
  );
}
