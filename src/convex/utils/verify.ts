import schema from '@convex/schema';

import { verifyConfig } from './verify.lib';

export const { verify } = verifyConfig(schema, {
	uniqueColumns: {
		profile: {
			indexes: ['by_username'],
			identifiers: ['userId', '_id'],
		},
	},
	uniqueRows: {
		project: {
			by_orgSlug_slug: ['orgSlug', 'slug'],
			identifiers: ['_id'],
		},
		feedbackBoard: {
			by_name_projectId: ['name', 'projectId'],
			identifiers: ['_id'],
		},
	},
	// uneditableColumns: {
	// 	profile: [],
	// },
	// defaultValues: {}
});
