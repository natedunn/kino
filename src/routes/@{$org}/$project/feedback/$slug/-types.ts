export type ProfileSummary = {
	id?: string;
	imageUrl?: string | null;
	name?: string | null;
	username: string;
};

export type FeedbackCommentData = {
	author: ProfileSummary | null;
	canDelete?: boolean;
	canEdit?: boolean;
	content: string;
	createdAt: number | string | Date;
	emoteCounts?: Record<string, { authorProfileIds: Array<string>; count: number }>;
	id: string;
	initial?: boolean;
	isTeamMember?: boolean;
	updatedTime?: number | string | Date | null;
};

export type FeedbackEventData = {
	actor?: ProfileSummary | null;
	createdAt: number | string | Date;
	eventType:
		| 'answer_marked'
		| 'answer_unmarked'
		| 'assigned'
		| 'board_changed'
		| 'priority_changed'
		| 'status_changed'
		| 'title_changed'
		| 'unassigned'
		| string;
	id: string;
	metadata?: {
		newValue?: string | null;
		oldValue?: string | null;
	} | null;
	targetProfile?: ProfileSummary | null;
};

export type TimelineItem =
	| { type: 'comment'; id: string; createdAt: number; cursor: string; data: FeedbackCommentData }
	| { type: 'event'; id: string; createdAt: number; cursor: string; data: FeedbackEventData };

export type GitHubConnectionData = {
	githubNumber: number;
	id: string;
	kind: 'issue';
	state: string;
	title: string;
	url: string;
};

export type GitHubTargetData = {
	databaseId?: number;
	kind: 'issue';
	nodeId: string;
	number: number;
	state: string;
	title: string;
	url: string;
};
