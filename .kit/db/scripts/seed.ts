import 'dotenv/config';

// import { seeder } from '../seed';
import { log } from '@/kit/utils';

const seed = async () => {
	log.start('⏳ Seeding database...');
	const start = Date.now();

	// await seeder();

	const end = Date.now();
	log.success('Seeding completed in', end - start, 'ms');
	process.exit(0);
};

seed().catch((err) => {
	log.error('Seeding failed');
	log.error(err);
	process.exit(1);
});
