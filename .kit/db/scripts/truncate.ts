// import { confirm } from '@inquirer/prompts';
import consola from 'consola';
import { sql } from 'drizzle-orm';

import { httpDb } from '@/kit/db';

export const truncate = async () => {
	const answer = consola.prompt('Are you sure you want to truncate all tables?', {
		type: 'confirm',
	});

	if (!answer) {
		consola.error('Truncating all tables cancelled');
		process.exit(0);
	}

	consola.start('Truncating tables...');

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

	consola.success('✅ Truncating completed in', end - start, 'ms');

	process.exit(0);
};

truncate().catch((err) => {
	consola.error('Truncating failed');
	consola.error(err);
	process.exit(1);
});
