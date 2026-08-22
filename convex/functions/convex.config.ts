import r2 from '@convex-dev/r2/convex.config';
import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({
	env: {
		FILES_ORIGIN: v.optional(v.string()),
	},
});

app.use(r2);

export default app;
