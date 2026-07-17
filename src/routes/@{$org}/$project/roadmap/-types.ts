import type { Icon as IconType } from '@/icons/types';

export type RoadmapStatus = 'backlog' | 'planned' | 'in-progress' | 'released';
export type ViewMode = 'board' | 'list' | 'timeline';

export interface RoadmapItem {
	id: string;
	title: string;
	status: RoadmapStatus;
	tags: Array<string>;
	upvotes: number;
	feedbackCount: number;
	githubIssues: number;
	quarter: string;
}

export interface StatusConfig {
	label: string;
	Icon: IconType;
	colorClass: string;
	bgClass: string;
	borderClass: string;
	leftBorderClass: string;
}
