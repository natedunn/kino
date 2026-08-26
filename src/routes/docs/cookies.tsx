import { createFileRoute, Link } from '@tanstack/react-router';

import { LegalContact, LegalPage } from '@/components/legal/legal-page';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/cookies')({
	head: () => ({ meta: [titleMeta(['Cookie Policy'])] }),
	component: CookiePolicyPage,
});

function CookiePolicyPage() {
	return (
		<LegalPage
			title='Cookie policy'
			description='This policy explains how Kino uses cookies and similar browser storage technologies.'
		>
			<h2>What these technologies are</h2>
			<p>
				Cookies are small text files stored by a website in your browser. Kino also uses similar
				technologies, including local storage, to remember information on your device. Some are set
				by Kino, while others may be set by services that help us operate and understand the
				Service.
			</p>

			<h2>How Kino uses them</h2>
			<h3>Strictly necessary</h3>
			<p>
				Authentication and security cookies keep you signed in, maintain a session, complete login
				or OAuth redirects, prevent request forgery, and protect account access. The Service may not
				work correctly if these cookies are blocked. These cookies may include a session token and
				short-lived verification or state values.
			</p>

			<h3>Preferences and functionality</h3>
			<p>
				Kino uses local storage to remember choices such as light or dark theme, collapsed
				navigation sections, and the last selected organization in settings. These values generally
				describe the interface preference rather than the content of your work.
			</p>

			<h3>Analytics and reliability</h3>
			<p>
				In production, Kino uses PostHog to measure page views and selected product events,
				associate activity with an account after sign-in, capture client-side errors, and provide
				masked session replay. PostHog may use cookies or local storage identifiers to distinguish
				users and sessions. Kino disables automatic event capture and configures text, element
				attributes, and input values to be masked in recordings.
			</p>

			<h2>Current technology summary</h2>
			<div className='not-prose overflow-x-auto'>
				<table className='w-full min-w-xl border-collapse text-left text-sm'>
					<thead>
						<tr className='border-b border-border'>
							<th className='py-3 pr-4 font-semibold'>Category</th>
							<th className='py-3 pr-4 font-semibold'>Purpose</th>
							<th className='py-3 font-semibold'>Typical duration</th>
						</tr>
					</thead>
					<tbody className='text-muted-foreground'>
						<tr className='border-b border-border/60 align-top'>
							<td className='py-3 pr-4 text-foreground'>Session and security</td>
							<td className='py-3 pr-4'>Sign-in, session continuity, and OAuth security.</td>
							<td className='py-3'>Session-based or until the configured expiry.</td>
						</tr>
						<tr className='border-b border-border/60 align-top'>
							<td className='py-3 pr-4 text-foreground'>Interface preferences</td>
							<td className='py-3 pr-4'>Theme and navigation preferences in local storage.</td>
							<td className='py-3'>Until cleared or replaced.</td>
						</tr>
						<tr className='border-b border-border/60 align-top'>
							<td className='py-3 pr-4 text-foreground'>PostHog analytics</td>
							<td className='py-3 pr-4'>Usage measurement, reliability, and masked replay.</td>
							<td className='py-3'>Varies by identifier and PostHog configuration.</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Your choices</h2>
			<p>
				Most browsers let you view, delete, or block cookies and site data. You can also clear local
				storage through browser settings. Blocking necessary storage may sign you out or prevent
				authentication and other features from working. Browser privacy controls, extensions, and
				device settings may provide additional choices.
			</p>
			<p>
				Kino will provide an in-product control for opting out of nonessential analytics and session
				replay. Strictly necessary storage used for authentication, security, and core functionality
				will remain active. The control must be implemented and tested before this policy is
				published. Where local law requires consent before analytics storage is used, Kino should
				not activate that storage until the required choice has been made.
			</p>

			<h2>Third-party services</h2>
			<p>
				Third-party sites opened from Kino, including GitHub, control their own cookies and similar
				technologies. Their practices are governed by their own policies. Additional providers may
				be added as Kino develops; material changes will be reflected here and, where required,
				presented for your choice.
			</p>

			<h2>Changes and more information</h2>
			<p>
				We may update this policy when the Service or legal requirements change. For more about how
				information is handled, read the <Link to='/docs/privacy'>privacy policy</Link>.
			</p>

			<h2>Contact</h2>
			<LegalContact />
		</LegalPage>
	);
}
