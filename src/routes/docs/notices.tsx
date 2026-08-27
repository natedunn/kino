import { createFileRoute } from '@tanstack/react-router';

import { DocsPageHeader } from '@/components/docs/docs-page-header';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/notices')({
	head: () => ({ meta: [titleMeta(['Notices'])] }),
	component: NoticesPage,
});

function NoticesPage() {
	return <DocsPageHeader title='Notices' description='Policies and guidelines for using Kino.' />;
}
