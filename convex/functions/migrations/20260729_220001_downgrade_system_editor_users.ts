import { defineMigration } from '../generated/migrations.gen';

export const migration = defineMigration({
	id: '20260729_220001_downgrade_system_editor_users',
	description: 'Downgrade removed system editor accounts to ordinary users',
	up: {
		table: 'user',
		migrateOne: (_ctx, doc) => {
			if (doc.role === 'system:editor') return { role: 'user' };
		},
	},
});
