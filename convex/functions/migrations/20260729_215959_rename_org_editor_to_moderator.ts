import { defineMigration } from '../generated/migrations.gen';

export const migration = defineMigration({
	id: '20260729_215959_rename_org_editor_to_moderator',
	description: 'Rename legacy organization editors without granting project access',
	up: {
		table: 'member',
		migrateOne: (_ctx, doc) => {
			if (doc.role === 'editor') return { role: 'moderator' };
		},
	},
});
