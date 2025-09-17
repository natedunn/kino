// convex/betterAuth/org.ts
import { convexToZod } from 'convex-helpers/server/zod';

import { zQuery } from '../utils/functions';
import { tables } from './generatedSchema';

const organizationSchema = convexToZod(tables.organization.validator);

export const getOrg = zQuery({
	args: {
		slug: organizationSchema.pick({ slug: true }),
	},
	handler: async (ctx, args) => {
		// do something here
	},
});
