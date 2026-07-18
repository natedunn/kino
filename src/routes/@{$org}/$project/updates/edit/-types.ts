import type { UpdateCategory } from '../-components/category-badge';

export type DashboardUpdate = {
	author: {
		id: string;
		imageUrl: string | null;
		name: string | null;
		username: string | null;
	} | null;
	category: UpdateCategory;
	createdAt: number;
	id: string;
	publishedAt?: number | null;
	slug: string;
	status: 'draft' | 'published';
	title: string;
	updatedTime?: number | null;
};

export type DeleteDialogState = {
	ids: Array<string>;
	updates: Array<{ id: string; title: string }>;
} | null;

export type StatusFilter = 'all' | 'draft' | 'published';
