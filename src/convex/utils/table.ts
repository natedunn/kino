import { zodToConvex } from 'convex-helpers/server/zod4';
import { defineTable } from 'convex/server';
import * as z from 'zod';

export function defineZTable<T extends z.ZodObject<any>>(schema: T) {
	const table = zodToConvex(schema);
	return defineTable(table);
}
