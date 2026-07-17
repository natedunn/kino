import { createFileRoute } from '@tanstack/react-router';

import { projectTitle, titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/@{$org}/$project/discussions/')({
	head: ({ params }) => ({
		meta: [titleMeta(['Discussions', projectTitle(params.org, params.project)])],
	}),
	component: PlaceholderPage,
});

function PlaceholderPage() {
	return <div className='container py-10'></div>;
}
