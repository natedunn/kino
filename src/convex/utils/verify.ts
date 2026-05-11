import schema from '@convex/schema';
import { createExtension, verifyConfig } from 'convex-verify';

import { generateRandomSlug } from '@/lib/random';

const shouldLogVerifyPayloads =
	process.env.CONVEX_VERIFY_LOG_PAYLOADS === 'true' ||
	process.env.NODE_ENV === 'development';

const loggingExtension = createExtension(schema, (input) => {
	if (input.operation === 'insert') {
		if (shouldLogVerifyPayloads) {
			console.log(`[${input.tableName}] INSERT:`, input.data);
		} else {
			console.log(`[${input.tableName}] INSERT fields:`, Object.keys(input.data));
		}
	} else {
		if (shouldLogVerifyPayloads) {
			console.log(`[${input.tableName}] PATCH ${input.patchId}:`, input.data);
		} else {
			console.log(
				`[${input.tableName}] PATCH ${input.patchId} fields:`,
				Object.keys(input.data),
			);
		}
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
