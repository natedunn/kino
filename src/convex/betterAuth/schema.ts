import { defineSchema } from 'convex/server';

import { tables } from './generatedSchema';

const schema = defineSchema({
	...tables,
	user: tables.user.index('profileId', ['profileId']),
	member: tables.member.index('userId_organizationId', ['userId', 'organizationId']),
});

export default schema;
