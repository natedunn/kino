import schema from '@convex/schema';
import { createExtension, verifyConfig } from 'convex-verify';

import { generateRandomSlug } from '@/lib/random';

const loggingExtension = createExtension(schema, (input) => {
	if (input.operation === 'insert') {
		console.log(`[${input.tableName}] INSERT:`, input.data);
	} else {
		console.log(`[${input.tableName}] PATCH ${input.patchId}:`, input.data);
	}

	return input.data;
});

export const { insert, patch, dangerouslyPatch, config } = verifyConfig(schema, {
	defaultValues: () =>
		({
			feedbackBoard: {
				slug: generateRandomSlug(),
			},
			feedback: {
				status: 'open',
				slug: generateRandomSlug(),
				upvotes: 1,
			},
			update: {
				status: 'draft',
				slug: generateRandomSlug(),
			},
		}) as const,
	protectedColumns: {
		feedback: ['projectId'],
	},
	uniqueRow: {
		project: ['by_orgSlug_slug'],
		feedback: ['by_projectId_slug'],
	},
	uniqueColumn: {
		profile: ['by_username'],
	},
	extensions: [loggingExtension],
});
