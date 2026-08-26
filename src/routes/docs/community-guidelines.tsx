import { createFileRoute } from '@tanstack/react-router';

import { LegalContact, LegalPage } from '@/components/legal/legal-page';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/docs/community-guidelines')({
	head: () => ({ meta: [titleMeta(['Community Guidelines'])] }),
	component: CommunityGuidelinesPage,
});

function CommunityGuidelinesPage() {
	return (
		<LegalPage
			title='Community guidelines'
			description='These guidelines help keep Kino’s public and shared spaces useful, safe, and welcoming.'
		>
			<h2>Where these guidelines apply</h2>
			<p>
				These guidelines apply to public profiles, feedback boards, comments, reactions, updates,
				roadmaps, links, files, and other content or interactions hosted by Kino. They also apply to
				private or team spaces when conduct threatens people, the Service, or the wider community.
				Project owners may adopt additional rules for their spaces, provided those rules do not
				conflict with these guidelines.
			</p>

			<h2>Be constructive</h2>
			<ul>
				<li>Discuss ideas and work without attacking the people behind them.</li>
				<li>Give clear, relevant feedback and assume good faith where reasonable.</li>
				<li>Respect project scope, moderation decisions, and other people&apos;s boundaries.</li>
				<li>
					Label conflicts of interest, affiliations, and synthetic or automated content when
					relevant.
				</li>
				<li>
					Use titles, tags, and reactions accurately so others can understand and find content.
				</li>
			</ul>

			<h2>Do not harm or harass people</h2>
			<p>Do not post or engage in:</p>
			<ul>
				<li>harassment, bullying, stalking, intimidation, or coordinated abuse;</li>
				<li>credible threats, glorification of violence, or encouragement of self-harm;</li>
				<li>
					hateful conduct that attacks or dehumanizes people based on protected characteristics;
				</li>
				<li>
					sexual exploitation, non-consensual intimate content, or sexual content involving minors;
				</li>
				<li>publishing private or identifying information without authorization (“doxxing”); or</li>
				<li>
					impersonation intended to deceive, defraud, or damage another person or organization.
				</li>
			</ul>

			<h2>Do not abuse the platform</h2>
			<ul>
				<li>
					Do not post malware, phishing material, credential theft, or instructions intended to
					compromise systems or accounts.
				</li>
				<li>
					Do not evade access controls, probe private data, interfere with availability, or exploit
					a vulnerability outside responsible security testing.
				</li>
				<li>
					Do not spam, create deceptive engagement, manipulate votes or reactions, or use
					coordinated accounts to mislead others.
				</li>
				<li>
					Do not use Kino to facilitate fraud, illegal activity, or violations of others&apos;
					rights.
				</li>
				<li>
					Do not publish content you lack the right to share, including copyrighted material, trade
					secrets, or confidential information.
				</li>
			</ul>

			<h2>Moderation</h2>
			<p>
				Users may report suspected violations to Kino regardless of which project or organization
				the conduct occurs in. Kino may review reports and take action when these guidelines or
				applicable law are violated. Depending on context and severity, action may include reducing
				visibility, removing content, limiting features, disconnecting an integration, suspending or
				terminating an account or workspace, or preserving and reporting information where legally
				required.
			</p>
			<p>
				We consider context, severity, intent, impact, prior behavior, and whether a user attempts
				to remedy harm. We may act immediately where necessary to protect people or the Service.
			</p>
			<p>
				Project owners may enforce additional community rules and make moderation decisions that do
				not amount to a violation of Kino&apos;s platform-wide rules. Kino plans to add
				organization- level reporting tools for those local decisions. Until those tools exist,
				organization moderators may provide their own reporting process.
			</p>

			<h2>Reporting and appeals</h2>
			<p>
				Use Kino&apos;s global in-product reporting controls when they are available. Reports should
				include the relevant URL, a concise description, and any context needed to understand the
				issue. Do not repost harmful material unnecessarily. For conduct that violates only a
				project or organization&apos;s local rules, use that organization&apos;s reporting process
				when one is available.
			</p>
			<p>
				If Kino acts on your content or account, you may request another review. Appeals should
				identify the decision, explain why it should be reconsidered, and include relevant context.
				Repeated or abusive appeals may not receive a response.
			</p>

			<h2>Contact</h2>
			<LegalContact />
		</LegalPage>
	);
}
