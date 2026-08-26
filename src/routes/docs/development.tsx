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
				Kino is being actively designed, tested, and improved. Features may be incomplete,
				experimental, unavailable, or materially changed without notice. Interfaces, permissions,
				data models, limits, integrations, and URLs may change as the product develops.
			</p>

			<h2>Eligibility</h2>
			<p>
				You must be at least 16 years old to create an account or use Kino&apos;s interactive
				features. If you are 16 or 17 and are not legally able to agree to service terms on your own
				where you live, you may use Kino only with permission from a parent or legal guardian.
			</p>

			<h2>Production data preservation</h2>
			<p>
				Preserving production data throughout development is a core engineering goal. Kino does not
				plan to use routine production data resets as part of development, and production migrations
				should be designed to preserve existing information. If a known change creates a material
				risk to stored data, Kino will aim to provide advance notice and a reasonable opportunity to
				export affected information where practical.
			</p>
			<p>
				This goal is not a guarantee that loss can never occur. Unless expressly agreed otherwise in
				writing, Kino does not currently make service-level commitments about uptime, support
				response times, compatibility, performance, or the continued availability of any feature.
				Maintenance, incidents, migrations, and third-party outages may interrupt the Service.
			</p>

			<h2>Keep your own copies</h2>
			<p>
				Do not use Kino as the only copy of business-critical, legally required, or irreplaceable
				information. Keep independent backups of important content and source material. Where
				available, account data can be downloaded from the data settings, but an export is not a
				complete backup or restoration service.
			</p>

			<h2>Use appropriate test data</h2>
			<p>
				Avoid submitting regulated, highly sensitive, or confidential information unless the Service
				has been expressly approved for that use. Examples include government identifiers, payment
				card data, health records, private keys, passwords, access tokens, and information subject
				to special contractual or regulatory controls.
			</p>

			<h2>Public and collaborative features</h2>
			<p>
				Kino includes public project pages and collaborative spaces. Visibility settings, membership
				rules, and moderation tools may evolve. Verify who can view a destination before posting,
				and do not rely on obscurity or an unlisted URL to protect sensitive information. Use of
				shared spaces is also subject to the{' '}
				<Link to='/docs/community-guidelines'>community guidelines</Link>.
			</p>

			<h2>Integrations and external services</h2>
			<p>
				Integrations such as GitHub depend on third-party APIs, permissions, and availability.
				Synchronization may be delayed, partial, duplicated, or interrupted. Review proposed changes
				before enabling write access, use the narrowest permissions suitable for your needs, and
				verify important changes in the source system.
			</p>

			<h2>Security and responsible testing</h2>
			<p>
				We welcome responsible reports that help improve Kino. Do not access another person&apos;s
				account or data, degrade the Service, use automated testing that creates material traffic,
				exfiltrate information, or publicly disclose an unresolved vulnerability. Stop testing if
				you encounter private data and report the issue through Kino&apos;s private in-product
				channel once available, with the minimum information needed to reproduce it. Do not place
				vulnerability details in a public feedback item or GitHub issue.
			</p>

			<h2>Feedback and changes</h2>
			<p>
				Feedback, bug reports, and feature requests are welcome. We may use feedback to improve Kino
				without an obligation to implement it or compensate the submitter. This notice may be
				updated as the Service matures; the date above indicates the latest revision.
			</p>

			<h2>Contact</h2>
			<LegalContact />
		</LegalPage>
	);
}
