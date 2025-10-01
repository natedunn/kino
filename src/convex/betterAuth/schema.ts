import { defineSchema } from 'convex/server';

import { tables } from './generatedSchema';

const schema = defineSchema({
	...tables,
	member: tables.member
		.index('userId_organizationId', ['userId', 'organizationId'])
		.index('organizationId', ['organizationId']),
});

export default schema;
