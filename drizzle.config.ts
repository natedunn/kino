import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './migrations',
	schema: './lib/db/tables/index.ts',
	dialect: 'mysql',
	dbCredentials: {
		// the `?ssl={}` is required to allow TiDB to work with `mysql2` and Drizzle Studio
		url: `${process.env.DATABASE_URL!}${process.env.NODE_ENV === 'production' ? '' : '?ssl={}'}`,
	},
});
