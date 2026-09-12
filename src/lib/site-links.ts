import * as m from '@/paraglide/messages.js';

/**
 * Single source of truth for site-wide navigation that isn't part of the app
 * shell: footer columns, social profiles, and the public marketing pages.
 *
 * Everything the product doesn't have yet is declared here as `soon` (a muted,
 * non-interactive label) or as a social entry with `href: null` (a disabled
 * icon). Flip an entry to `internal` / `external` or fill in the URL to go
 * live — no footer or page code needs to change.
 *
 * See `docs/marketing-site.md` for the inventory of what is still placeholder.
 */

/**
 * Kino's own project on Kino. Feedback, roadmap, and release notes for the
 * product live here — this is the canonical public channel, so the org and
 * project must exist in every environment.
 */
export const KINO_PROJECT = { org: 'natedunn', project: 'kino' } as const;

/** Where the code lives. Never the place we send people for issues or announcements. */
export const KINO_GITHUB_URL = 'https://github.com/natedunn/kino';

/** Internal routes the footer is allowed to point at (typed against the route tree). */
export type SiteInternalTo =
	| '/about'
	| '/brand'
	| '/contact'
	| '/docs/privacy'
	| '/docs/cookies'
	| '/docs/community-guidelines'
	| '/docs/development'
	| '/docs/stack';

export type SiteLink =
	| { kind: 'internal'; label: () => string; to: SiteInternalTo }
	| { kind: 'kino'; label: () => string; page: 'feedback' | 'roadmap' | 'updates' }
	| { kind: 'external'; label: () => string; href: string }
	| { kind: 'soon'; label: () => string };

export type SiteLinkGroup = {
	id: 'product' | 'resources' | 'legal' | 'company';
	title: () => string;
	links: ReadonlyArray<SiteLink>;
};

export const FOOTER_GROUPS: ReadonlyArray<SiteLinkGroup> = [
	{
		id: 'product',
		title: m.footer_group_product,
		links: [
			{ kind: 'soon', label: m.footer_link_features },
			{ kind: 'soon', label: m.footer_link_pricing },
			{ kind: 'kino', label: m.footer_link_changelog, page: 'updates' },
			{ kind: 'kino', label: m.footer_link_roadmap, page: 'roadmap' },
		],
	},
	{
		id: 'resources',
		title: m.footer_group_resources,
		links: [
			{ kind: 'kino', label: m.footer_link_feedback, page: 'feedback' },
			{ kind: 'internal', label: m.footer_link_stack, to: '/docs/stack' },
			{ kind: 'external', label: m.footer_link_github, href: KINO_GITHUB_URL },
			{ kind: 'soon', label: m.footer_link_docs },
			{ kind: 'soon', label: m.footer_link_status },
		],
	},
	{
		id: 'legal',
		title: m.footer_group_legal,
		links: [
			{ kind: 'soon', label: m.footer_link_terms },
			{ kind: 'internal', label: m.footer_link_privacy, to: '/docs/privacy' },
			{ kind: 'internal', label: m.footer_link_cookies, to: '/docs/cookies' },
			{ kind: 'internal', label: m.footer_link_community, to: '/docs/community-guidelines' },
			{ kind: 'internal', label: m.footer_link_development, to: '/docs/development' },
		],
	},
	{
		id: 'company',
		title: m.footer_group_company,
		links: [
			{ kind: 'internal', label: m.footer_link_about, to: '/about' },
			{ kind: 'internal', label: m.footer_link_brand, to: '/brand' },
			{ kind: 'internal', label: m.footer_link_contact, to: '/contact' },
		],
	},
];

export type SocialNetworkId = 'github' | 'x' | 'bluesky' | 'discord';

export type SocialLink = {
	id: SocialNetworkId;
	/** Brand name, never translated. */
	name: string;
	/** `null` renders a disabled icon until the profile exists. */
	href: string | null;
};

export const SOCIAL_LINKS: ReadonlyArray<SocialLink> = [
	{ id: 'github', name: 'GitHub', href: KINO_GITHUB_URL },
	{ id: 'x', name: 'X', href: null },
	{ id: 'bluesky', name: 'Bluesky', href: null },
	{ id: 'discord', name: 'Discord', href: null },
];
