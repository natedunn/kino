// import { sql } from 'drizzle-orm';

// import { httpDb } from '@/kit/db';

import 'dotenv/config';

import { log } from '@/kit/utils';

import { client } from '..';

export const truncate = async () => {
	const confirm = await log.prompt(
		'🔴 DANGER: You are about to ✨TRUNCATE✨ _ALL_ tables in the database. This is not reversible, and should only be used on a test or local database. Are you absolutely sure?',
		{
			type: 'confirm',
		}
	);

	if (!confirm) {
		log.error('Truncating all tables cancelled');
		process.exit(0);
	}

	const schema = await log.prompt('Which schema do you want to truncate all tables in?', {
		type: 'text',
		required: true,
		default: 'test',
	});

	log.start('Truncating tables...');

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
		await client.execute(`TRUNCATE TABLE \`${row.table_name}\``);
	}

	await client.execute(`SET FOREIGN_KEY_CHECKS = 1`);

	const end = Date.now();

	log.success('✅ Truncating completed in', end - start, 'ms');

	process.exit(0);
};

truncate().catch((err) => {
	log.error('Truncating failed');
	log.error(err);
	process.exit(1);
});
