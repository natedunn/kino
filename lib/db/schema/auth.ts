import type { SchemaCrud } from '@/kit/db/utils';
import type { BuildRefine } from 'node_modules/drizzle-zod/schema.types.internal.d.ts';

import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import * as auth from '../tables/auth';

//
// User
const refineUser = {
	role: () => z.enum(['member', 'admin']),
	// Setting as optional because this column is mostly a database check for uniqueness
	normalizedEmail: (v) => v.optional(),
} satisfies BuildRefine<typeof auth.user>;

export const userSchema = {
	create: createInsertSchema(auth.user, refineUser),
	read: createSelectSchema(auth.user, refineUser),
	update: createUpdateSchema(auth.user, refineUser),
	delete: createUpdateSchema(auth.user, refineUser).pick({ id: true }),
};

export type UserSchema = SchemaCrud<typeof userSchema>;
