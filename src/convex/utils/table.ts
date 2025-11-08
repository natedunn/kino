import { zodOutputToConvex, zodToConvex } from 'convex-helpers/server/zod4';
import { defineTable } from 'convex/server';
import z from 'zod';

export function defineZTable<T extends z.ZodObject<any>>(schema: T) {
	const table = zodToConvex(schema);
	return defineTable(table);
}
