import type { ComponentPropsWithoutRef } from 'react';

import { Link } from '@tanstack/react-router';

import { KINO_PROJECT } from '@/lib/site-links';

export type KinoProjectPage = 'feedback' | 'roadmap' | 'updates';

type KinoProjectLinkProps = { page: KinoProjectPage } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>;

/**
 * Typed link into Kino's own project (`@natedunn/kino`). Kino dogfoods itself:
 * feedback, the roadmap, and release notes for Kino live on a Kino project,
 * not on a third-party tracker.
 *
 * One `Link` per page keeps `to` a literal so TanStack can type `params`.
 */
export function KinoProjectLink({ page, ...props }: KinoProjectLinkProps) {
	switch (page) {
		case 'feedback':
			return <Link to='/@{$org}/$project/feedback' params={KINO_PROJECT} {...props} />;
		case 'roadmap':
			return <Link to='/@{$org}/$project/roadmap' params={KINO_PROJECT} {...props} />;
		case 'updates':
			return <Link to='/@{$org}/$project/updates' params={KINO_PROJECT} {...props} />;
	}
}
