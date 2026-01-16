import schema from '@convex/schema';

import { generateRandomSlug } from '@/lib/random';

import { verifyConfig } from './verifyInternal';
import {
	verifyConfig as _verifyConfig,
	defaultValuesConfig,
	uniqueRowConfig,
} from './verifyInternal/v2/index';

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

export const defaultValues = defaultValuesConfig(schema, {
	feedbackBoard: {
		slug: generateRandomSlug(),
	},
	feedback: {
		status: 'open',
		slug: generateRandomSlug(),
		upvotes: 1,
	},
});

export const uniqueRow = uniqueRowConfig(schema, {
	feedback: [
		{
			index: 'by_projectId_slug',
		},
	],
});

export const { insert, patch, configs } = _verifyConfig(schema, {
	defaultValues: defaultValuesConfig(schema, {
		feedbackBoard: {
			slug: generateRandomSlug(),
		},
		feedback: {
			status: 'open',
			slug: generateRandomSlug(),
			upvotes: 1,
		},
	}),
	uniqueRow: uniqueRowConfig(schema, {
		project: [
			{
				index: 'by_orgSlug_slug',
			},
		],
		feedback: [
			{
				index: 'by_projectId_slug',
			},
		],
	}),
});
