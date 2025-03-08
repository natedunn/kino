import 'dotenv/config';

// import { seeder } from '../seed';
import { logger } from '@/kit/utils';

const seed = async () => {
	logger.start('⏳ Seeding database...');
	const start = Date.now();

	// await seeder();

	const end = Date.now();
	logger.success('Seeding completed in', end - start, 'ms');
	process.exit(0);
};

seed().catch((err) => {
	logger.error('Seeding failed');
	logger.error(err);
	process.exit(1);
});
