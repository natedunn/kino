// import type { NeonQueryFunction } from '@neondatabase/serverless';

// import { neon, Pool } from '@neondatabase/serverless';
// import { drizzle } from 'drizzle-orm/neon-serverless';
// import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { connect } from '@tidbcloud/serverless';
import { drizzle } from 'drizzle-orm/tidb-serverless';

import { env } from '@/lib/env/server';

import * as tables from '../../lib/db/tables';

export const client = connect({ url: env.DATABASE_URL });
export const db = drizzle({ client, schema: tables });

export const httpDb = db;
