import consola from 'consola';

import 'dotenv/config';

// import { seeder } from '../seed';

const seed = async () => {
	consola.start('⏳ Seeding database...');
	const start = Date.now();

	// await seeder();

	const end = Date.now();
	consola.success('Seeding completed in', end - start, 'ms');
	process.exit(0);
};

seed().catch((err) => {
	consola.error('Seeding failed');
	consola.error(err);
	process.exit(1);
});
