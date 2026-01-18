import type { ValidateContext } from 'convex-verify';

import schema from '@convex/schema';
import {
	verifyConfig as _verifyConfig,
	createValidatePlugin,
	defaultValuesConfig,
	protectedColumnsConfig,
	uniqueColumnConfig,
	uniqueRowConfig,
} from 'convex-verify';

import { generateRandomSlug } from '@/lib/random';

// Old verifyConfig (legacy)
import { verifyConfig } from './verifyInternal';

// New verifyConfig from convex-verify package

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

// Standalone defaultValuesConfig example (can use static, sync function, or async function)
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

const uniqueRows = uniqueRowConfig(schema, {
	project: ['by_orgSlug_slug'],
	feedback: ['by_projectId_slug'],
});

const uniqueColumns = uniqueColumnConfig(schema, {
	profile: ['by_username'],
});

// =============================================================================
// Example: Custom Validate Plugin
// =============================================================================

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

// =============================================================================
// Main verifyConfig with plugins
// =============================================================================

export const { insert, patch, dangerouslyPatch, configs } = _verifyConfig(schema, {
	// Using async function form for fresh values on each insert
	defaultValues: defaultValuesConfig(schema, () => ({
		feedbackBoard: {
			slug: generateRandomSlug(),
		},
		feedback: {
			status: 'open',
			slug: generateRandomSlug(),
			upvotes: 1,
		},
	})),
	// Protected columns - these cannot be patched (use dangerouslyPatch to bypass)
	protectedColumns: protectedColumnsConfig(schema, {
		feedback: ['projectId'],
	}),
	// Add custom validate plugins here
	plugins: [loggingPlugin, uniqueRows, uniqueColumns],
});
