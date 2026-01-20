import { create } from 'node:domain';
import type { ValidateContext } from 'convex-verify';

import schema from '@convex/schema';
import {
	createValidatePlugin,
	defaultValuesConfig,
	protectedColumnsConfig,
	uniqueColumnConfig,
	uniqueRowConfig,
	verifyConfig,
} from 'convex-verify';

import { generateRandomSlug } from '@/lib/random';

/**
 * Example validate plugin that logs all inserts/patches.
 * This demonstrates how third-party plugins can be created.
 */
const loggingPlugin = createValidatePlugin(
	'logging',
	{ enabled: true },
	{
		insert: (context: ValidateContext, data: Record<string, unknown>) => {
			console.log(`[${context.tableName}] INSERT:`, data);
			return data;
		},
		patch: (context: ValidateContext, data: Record<string, unknown>) => {
			console.log(`[${context.tableName}] PATCH ${context.patchId}:`, data);
			return data;
		},
	}
);

export const { insert, patch, dangerouslyPatch, configs } = verifyConfig(schema, {
	defaultValues: defaultValuesConfig(schema, async () => ({
		feedbackBoard: {
			slug: generateRandomSlug(),
		},
		feedback: {
			status: 'open',
			slug: generateRandomSlug(),
			upvotes: 1,
		},
	})),
	protectedColumns: protectedColumnsConfig(schema, {
		feedback: ['projectId'],
	}),
	uniqueRows: uniqueRowConfig(schema, {
		project: ['by_orgSlug_slug'],
		feedback: ['by_projectId_slug'],
	}),
	uniqueColumns: uniqueColumnConfig(schema, {
		profile: ['by_username'],
	}),
	plugins: [
		createValidatePlugin(
			'logging',
			{ enabled: true },
			{
				insert: (context: ValidateContext, data: Record<string, unknown>) => {
					console.log(`[${context.tableName}] INSERT:`, data);
					return data;
				},
				patch: (context: ValidateContext, data: Record<string, unknown>) => {
					console.log(`[${context.tableName}] PATCH ${context.patchId}:`, data);
					return data;
				},
			}
		),
	],
});
