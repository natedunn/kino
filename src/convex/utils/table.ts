import { defineTable } from 'convex/server';
import z from 'zod';

import { zodOutputToConvex, zodToConvex } from '@/_modules/zod4';

export function defineZTable<T extends z.ZodObject<any>>(schema: T) {
	const table = zodToConvex(schema);
	return defineTable(table);
}
