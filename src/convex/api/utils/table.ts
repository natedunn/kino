import { zodOutputToConvex } from 'convex-helpers/server/zod';
import { defineTable } from 'convex/server';
import z from 'zod';

export function defineZTable<T extends z.ZodObject<any>>(schema: T) {
	return defineTable(zodOutputToConvex(schema));
}
