import { sql } from 'drizzle-orm';

import { httpDb } from '@/kit/db';

import 'dotenv/config';

import { logger } from '@/kit/utils';

export const truncate = async () => {
	const answer = logger.prompt('Are you sure you want to truncate all tables?', {
		type: 'confirm',
	});

	if (!answer) {
		logger.error('Truncating all tables cancelled');
		process.exit(0);
	}

	logger.start('Truncating tables...');

	const start = Date.now();

	const query = sql<string>`SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `;

	const result = await httpDb.execute(query);
	const tables = result.rows;

	for (const table of tables) {
		const query = sql.raw(`TRUNCATE TABLE "${table.table_name}" CASCADE;`);
		await httpDb.execute(query);
	}

	const end = Date.now();

	logger.success('✅ Truncating completed in', end - start, 'ms');

	process.exit(0);
};

truncate().catch((err) => {
	logger.error('Truncating failed');
	logger.error(err);
	process.exit(1);
});
