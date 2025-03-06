import type { z } from 'zod';

type InferSchema<T> = T extends z.ZodType ? z.infer<T> : never;

export type SchemaCrud<T extends Record<string, z.ZodType>> = {
	[K in keyof T as Capitalize<K & string>]: InferSchema<T[K]>;
};
