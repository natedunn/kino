import { migrate } from 'drizzle-orm/neon-http/migrator';

import { httpDb } from '@/kit/db';
import { logger } from '@/kit/utils';

import { setupGlobalUpdateTrigger } from './setup';

const runMigrate = async () => {
	const answer = await logger.prompt('Are you sure you want to run migrations?', {
		type: 'confirm',
	});

	if (!answer) {
		logger.error('Migrations cancelled');
		process.exit(0);
	}
	logger.start('Running migrations...');
	const start = Date.now();

	await setupGlobalUpdateTrigger();
	await migrate(httpDb, { migrationsFolder: './migrations' });

	const end = Date.now();
	logger.success('Migrations completed in', end - start, 'ms');
	process.exit(0);
};

runMigrate().catch((err) => {
	logger.error('Migration failed');
	logger.error(err);
	process.exit(1);
});
