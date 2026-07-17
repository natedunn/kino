import type { ReactNode } from 'react';

/** A single entry shown in the UI library sidebar (a component or an example). */
export type LabItem = {
	/** Stable id, also used in the URL hash. */
	id: string;
	/** Display name shown in the sidebar and content header. */
	name: string;
	/** Short one-line description shown under the header. */
	description: string;
	/** Optional small tag shown next to the sidebar entry. */
	tag?: string;
	/** Copy-to-clipboard import snippet shown under the page header. */
	importCode?: string;
	/** Renders the showcase content for this entry. */
	render: () => ReactNode;
};

export type LabSection = {
	id: string;
	label: string;
	items: LabItem[];
};
