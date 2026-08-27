import { createFileRoute, Link } from '@tanstack/react-router';

import { LegalContact, LegalPage } from '@/components/legal/legal-page';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/privacy')({
	head: () => ({ meta: [titleMeta(['Privacy Policy'])] }),
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<LegalPage
			title='Privacy policy'
			description='This policy explains what information Kino handles, why we handle it, and the choices available to you.'
		>
			<h2>Scope</h2>
			<p>
				Kino is operated by Nate Dunn in an individual capacity under the name “Kino” (“Kino,” “we,”
				“us,” or “our”). This policy applies to the Kino websites, applications, and related
				services (together, the “Service”). It applies when you create an account, join a team,
				manage a project, publish or respond to content, connect an integration, or otherwise use
				the Service.
			</p>

			<h2>Information we collect</h2>
			<h3>Information you provide</h3>
			<ul>
				<li>
					<strong>Account information:</strong> your name, email address, username, profile image,
					login credentials, and account preferences.
				</li>
				<li>
					<strong>Team and project information:</strong> organization names, memberships, roles,
					project settings, invitations, and access permissions.
				</li>
				<li>
					<strong>Content:</strong> feedback, comments, reactions, roadmap items, updates, links,
					files, and other material you submit to Kino.
				</li>
				<li>
					<strong>Communications:</strong> information you include when asking for support,
					reporting a problem, or otherwise contacting us.
				</li>
			</ul>

			<h3>Information collected through use of the Service</h3>
			<ul>
				<li>
					<strong>Device and log data:</strong> IP address, browser and device type, operating
					system, user agent, timestamps, referring pages, and security or error logs.
				</li>
				<li>
					<strong>Usage data:</strong> pages viewed, product features used, coarse event counts, and
					interactions needed to operate, secure, and improve Kino.
				</li>
				<li>
					<strong>Cookies and local storage:</strong> session, authentication, theme, navigation,
					and analytics identifiers described in our <Link to='/docs/cookies'>cookie policy</Link>.
				</li>
			</ul>

			<h3>Information from integrations</h3>
			<p>
				If you connect GitHub or another third-party service, Kino receives information permitted by
				the authorization you grant. This may include your third-party account identity,
				installation and repository metadata, issue information, and access tokens required to
				provide the integration. The third party also processes your information under its own terms
				and privacy policy.
			</p>

			<h2>How we use information</h2>
			<p>We use information to:</p>
			<ul>
				<li>provide, authenticate, maintain, and secure the Service;</li>
				<li>create accounts, teams, projects, and public project pages;</li>
				<li>deliver invitations, verification messages, and other transactional email;</li>
				<li>operate integrations and synchronize information at your direction;</li>
				<li>respond to support requests and enforce our policies;</li>
				<li>diagnose errors, prevent abuse, and protect users and the Service; and</li>
				<li>understand feature use and improve Kino.</li>
			</ul>

			<h2>Public content and workspace administrators</h2>
			<p>
				Kino is designed to publish some project information. Content submitted to a public project,
				public profile, feedback board, roadmap, or update page may be visible to anyone and may be
				indexed or copied by search engines and other people. Check the destination and project
				visibility before posting.
			</p>
			<p>
				Team and project administrators control membership, permissions, integrations, and much of
				the content in their spaces. If you use Kino through an organization, that organization may
				access, manage, export, or remove information associated with its workspace.
			</p>

			<h2>How we disclose information</h2>
			<p>We may disclose information:</p>
			<ul>
				<li>
					<strong>To other users and the public</strong> as directed by your actions, project
					settings, and workspace permissions.
				</li>
				<li>
					<strong>To service providers</strong> that host data, deliver the application and email,
					provide analytics, or help secure and operate Kino. Current providers include Convex,
					Cloudflare, PostHog, and Bento.
				</li>
				<li>
					<strong>To integration partners</strong> such as GitHub when you connect or use an
					integration.
				</li>
				<li>
					<strong>For legal and safety reasons</strong> when reasonably necessary to comply with
					law, respond to lawful process, enforce policies, or protect rights, safety, and security.
				</li>
				<li>
					<strong>In a business transaction</strong> involving a merger, financing, acquisition,
					reorganization, or sale of assets, subject to appropriate safeguards.
				</li>
			</ul>
			<p>We do not sell personal information for money.</p>

			<h2>Analytics and session replay</h2>
			<p>
				In production, Kino uses PostHog for limited product analytics, client-side error
				monitoring, and session replay. Autocapture is disabled. Input values and page text are
				configured to be masked, and event guidelines prohibit sending passwords, tokens, private
				content, form values, or full URLs containing sensitive parameters. No masking system is
				perfect, so this processing should remain subject to periodic review.
			</p>
			<p>
				Kino will provide an in-product control to opt out of nonessential analytics and session
				replay. Necessary authentication, security, and reliability processing may continue after an
				opt-out. The opt-out must be implemented and tested before this policy is published.
			</p>

			<h2>Retention</h2>
			<p>
				We retain information while your account or workspace is active and as reasonably needed to
				provide the Service, meet legal obligations, resolve disputes, maintain security, and
				enforce agreements. Retention varies by data type. Backups and logs may remain for a limited
				period after information is removed. Public content may remain available if it was copied or
				indexed by others.
			</p>

			<h2>Your choices and rights</h2>
			<ul>
				<li>Update available account and profile information in your settings.</li>
				<li>Export an available JSON copy from the account data settings.</li>
				<li>Disconnect integrations through organization or project settings.</li>
				<li>Control cookies and local storage using the choices described in the cookie policy.</li>
				<li>Ask to access, correct, delete, or restrict use of personal information.</li>
			</ul>
			<p>
				Your location may provide additional rights, including objection, portability, withdrawal of
				consent, or the right to complain to a data protection authority. We may need to verify your
				identity and may retain information where legally permitted or required.
			</p>

			<h2>Security and international processing</h2>
			<p>
				We use administrative, technical, and organizational measures intended to protect
				information. No online service can guarantee absolute security. Kino and its providers may
				process information in countries other than your own, where data protection laws may differ.
				Where required, appropriate transfer safeguards should be documented and used.
			</p>

			<h2>Age requirements</h2>
			<p>
				You must be at least 16 years old to create an account or use interactive features of the
				Service. If you have not reached the age at which you may agree to these terms independently
				where you live, you may use the Service only with permission from a parent or legal
				guardian. The Service is not directed to anyone under 16, and we do not knowingly collect
				personal information from anyone under 16. Contact us if you believe a person under 16 has
				created an account or submitted personal information.
			</p>

			<h2>Changes to this policy</h2>
			<p>
				We may update this policy as Kino changes. We will revise the date above and provide
				additional notice when changes are material or legally required.
			</p>

			<h2>Contact</h2>
			<LegalContact />
		</LegalPage>
	);
}
