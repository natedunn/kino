import { plans } from './plans';

type Limit = {
	[key in keyof typeof plans]: {
		MAX_ORGS: number;
		MAX_PROJECTS: number;
	};
};

export const LIMITS: Limit = {
	ADMIN: {
		MAX_ORGS: 100,
		MAX_PROJECTS: 100,
	},
	FREE: {
		MAX_ORGS: 1,
		MAX_PROJECTS: 1,
	},
	ONE: {
		MAX_ORGS: 3,
		MAX_PROJECTS: 3,
	},
};
