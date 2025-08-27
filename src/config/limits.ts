import { plans } from './plans';

type Limit = {
	[key in keyof typeof plans]: {
		MAX_ORGS: number;
		MAX_PROJECTS: number;
	};
};

export const limits: Limit = {
	admin: {
		MAX_ORGS: 100,
		MAX_PROJECTS: 100,
	},
	free: {
		MAX_ORGS: 1,
		MAX_PROJECTS: 1,
	},
	one: {
		MAX_ORGS: 3,
		MAX_PROJECTS: 3,
	},
};
