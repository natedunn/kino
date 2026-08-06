import { defineMigration } from '../generated/migrations.gen';

export const migration = defineMigration({
	id: '20260729_220002_downgrade_system_editor_profiles',
	description: 'Downgrade derived system editor profile roles to ordinary users',
	up: {
		table: 'profile',
		migrateOne: (_ctx, doc) => {
			if (doc.role === 'system:editor') return { role: 'user' };
		},
	},
});
