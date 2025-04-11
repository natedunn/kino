// import { sql } from 'drizzle-orm';

// import { httpDb } from '@/kit/db';
import { log } from '@/kit/utils';

export const dropTables = async () => {
	const answer = await log.prompt('Are you sure you want to drop all tables?', {
		type: 'confirm',
	});

	if (!answer) {
		log.error('❌ Dropping all tables cancelled');
		process.exit(0);
	}

	log.error('This script has been turned off due to it not working.');
	process.exit(0);

	// log.start('⏳ Dropping all tables in database...');

	// const start = Date.now();

	// const query = sql<string>`SELECT table_name
	//     FROM information_schema.tables
	//     WHERE table_schema = 'public'
	//       AND table_type = 'BASE TABLE';
	//   `;

	// const result = await httpDb.execute(query);
	// const tables = result.rows;

	// for (const table of tables) {
	// 	const query = sql.raw(`DROP TABLE "${table.table_name}" CASCADE;`);
	// 	await httpDb.execute(query);
	// }

	// const end = Date.now();

	// log.success('Dropped all tables in', end - start, 'ms');

	// process.exit(0);
};

dropTables().catch((err) => {
	log.error('❌ Dropping all tables failed');
	log.error(err);
	process.exit(1);
});
