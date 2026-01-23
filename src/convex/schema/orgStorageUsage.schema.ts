import * as z from 'zod';

import { SHARED_SCHEMA } from './_shared';

export const orgStorageUsageSchema = z.object({
	...SHARED_SCHEMA('orgStorageUsage'),
	orgSlug: z.string(),
	totalBytes: z.number(), // Total storage used in bytes
	fileCount: z.number(), // Number of files stored
});

export type OrgStorageUsage = z.infer<typeof orgStorageUsageSchema>;
