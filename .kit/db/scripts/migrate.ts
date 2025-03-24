import { migrate } from 'drizzle-orm/neon-http/migrator';

import { httpDb } from '@/kit/db';
import { log } from '@/kit/utils';

import { setupGlobalUpdateTrigger } from './setup';

const runMigrate = async () => {
	const answer = await log.prompt('Are you sure you want to run migrations?', {
		type: 'confirm',
	});

	if (!answer) {
		log.error('Migrations cancelled');
		process.exit(0);
	}
	log.start('Running migrations...');
	const start = Date.now();

	await setupGlobalUpdateTrigger();
	await migrate(httpDb, { migrationsFolder: './migrations' });

	const end = Date.now();
	log.success('Migrations completed in', end - start, 'ms');
	process.exit(0);
};

runMigrate().catch((err) => {
	log.error('Migration failed');
	log.error(err);
	process.exit(1);
});
