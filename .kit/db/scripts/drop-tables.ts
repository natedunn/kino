// import { sql } from 'drizzle-orm';
import { client } from '@/kit/db';
import { log } from '@/kit/utils';

export const dropTables = async () => {
	const confirm = await log.prompt(
		'🔴 DANGER: You are about to ✨DROP✨ _ALL_ tables in the database. This is not reversible, and should only be used on a test or local database. Are you absolutely sure?',
		{
			type: 'confirm',
		}
	);

	if (!confirm) {
		log.error('❌ Dropping all tables cancelled');
		process.exit(0);
	}

	const schema = await log.prompt('Which schema do you want to drop all tables in?', {
		type: 'text',
		required: true,
		default: 'test',
	});

	log.start('⏳ Dropping all tables in database...');

	const start = Date.now();

	const result = (await client
		.execute(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}'`)
		.catch((error) => {
			throw new Error(error);
		})) as { table_name: string }[];

	await client.execute(`SET FOREIGN_KEY_CHECKS = 0`);

	for (const row of result) {
		if (!row.table_name) {
			continue;
		}
		await client.execute(`DROP TABLE IF EXISTS  \`${row.table_name}\` CASCADE`);
	}

	await client.execute(`SET FOREIGN_KEY_CHECKS = 1`);

	const end = Date.now();

	log.success('Dropped all tables in', end - start, 'ms');

	process.exit(0);
};

dropTables().catch((err) => {
	log.error('❌ Dropping all tables failed');
	log.error(err);
	process.exit(1);
});
