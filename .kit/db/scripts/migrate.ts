import consola from 'consola';
import { migrate } from 'drizzle-orm/neon-http/migrator';

import { httpDb } from '@/kit/db';

import { setupGlobalUpdateTrigger } from './setup';

const runMigrate = async () => {
	const answer = await consola.prompt('Are you sure you want to run migrations?', {
		type: 'confirm',
	});

	if (!answer) {
		consola.error('Migrations cancelled');
		process.exit(0);
	}
	consola.start('Running migrations...');
	const start = Date.now();

	await setupGlobalUpdateTrigger();
	await migrate(httpDb, { migrationsFolder: './migrations' });

	const end = Date.now();
	consola.success('Migrations completed in', end - start, 'ms');
	process.exit(0);
};

runMigrate().catch((err) => {
	consola.error('Migration failed');
	consola.error(err);
	process.exit(1);
});
