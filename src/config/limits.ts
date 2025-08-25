import { plans } from './plans';

type Limit = {
	[key in keyof typeof plans]: {
		MAX_TEAMS: number;
	};
};

export const limits: Limit = {
	admin: {
		MAX_TEAMS: 100,
	},
	free: {
		MAX_TEAMS: 1,
	},
	one: {
		MAX_TEAMS: 3,
	},
};
