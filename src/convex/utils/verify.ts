import schema from '@convex/schema';

import { generateRandomSlug } from '@/lib/random';

import { verifyConfig } from './verifyInternal';

export const { verify, config } = verifyConfig(schema, {
	uniqueColumns: {
		profile: {
			indexes: ['by_username'],
			identifiers: ['userId', '_id'],
		},
	},
	uniqueRows: {
		project: [
			{
				index: 'by_orgSlug_slug',
			},
		],
		feedback: [
			// {
			// 	index: 'by_projectId_title',
			// },
			{
				index: 'by_projectId_slug',
			},
		],
	},
	uneditableColumns: {
		profile: ['userId'],
	},
	defaultValues: {
		feedbackBoard: {
			slug: generateRandomSlug(),
		},
		feedback: {
			status: 'open',
			slug: generateRandomSlug(),
			upvotes: 1,
		},
	},
});

// const defaultValues = defaultValuesConfig(schema, {
// 	feedbackBoard: {
// 		slug: generateRandomSlug(),
// 	},
// 	feedback: {
// 		status: 'open',
// 		slug: generateRandomSlug(),
// 		upvotes: 1,
// 	},
// });

// const { insert, patch } = verifyConfig(schema, {
// 	verify: [
// 		defaultValues,
// 		uniqueRows(schema, {
// 			project: [
// 				{
// 					index: 'by_orgSlug_slug',
// 				},
// 			],
// 			feedback: [
// 				// {
// 				// 	index: 'by_projectId_title',
// 				// },
// 				{
// 					index: 'by_projectId_slug',
// 				},
// 			],
// 		}),
// 	],
// });
