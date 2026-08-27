import { createFileRoute, Link } from '@tanstack/react-router';

import { LegalContact, LegalPage } from '@/components/legal/legal-page';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/development')({
	head: () => ({ meta: [titleMeta(['Development Notice'])] }),
	component: DevelopmentPage,
});

function DevelopmentPage() {
	return (
		<LegalPage
			title='Development notice'
			description='Kino is under active development. This notice sets expectations for using an evolving service.'
		>
			<h2>Preview software</h2>
			<p>
				Kino is being actively developed. Features may be incomplete, experimental, or unavailable.
				User interfaces & experiences, permissions, limits, integrations, URLs, and more may change
				as the product develops.
			</p>

			<h2>Eligibility</h2>
			<p>
				You must be at least 16 years old to create an account or use Kino&apos;s community
				features. Please, for everyone involved.
			</p>

			<h2>Production data preservation</h2>
			<p>
				Preserving production data throughout development is a core engineering goal. Kino does not
				plan to use routine production data resets as part of development. In a known situation
				where data loss may occur or will definitely occur, Kino will provide advance notice and a
				reasonable opportunity to export affected data. We don't want to screw you over, ever. This
				goal is not a guarantee that loss can never occur, though. Though downtime and maintenance
				is something we will try to avoid, Kino cannot promise 100% uptime or permanent access to
				read and write data.
			</p>

			<h2>Public and collaborative features</h2>
			<p>
				Kino includes public project pages and collaborative spaces. Visibility settings, membership
				rules, and moderation tools may evolve. Use of shared spaces is also subject to the{' '}
				<Link to='/docs/community-guidelines'>community guidelines</Link>.
			</p>

			<h2>Feedback and changes</h2>
			<p>
				Feedback, bug reports, and feature requests are welcome. We will try our best to attribute
				those who contribute to the product. Please use Kino itself to provide that feedback. This
				helps us dogfood our own product and improve it through real usage.
			</p>

			<h2>Contact</h2>
			<LegalContact />
		</LegalPage>
	);
}
