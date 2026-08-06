import { defineMigration } from '../generated/migrations.gen';

export const migration = defineMigration({
	id: '20260729_220000_rename_editor_invitations',
	description: 'Rename pending and historical editor invitations to moderator',
	up: {
		table: 'invitation',
		migrateOne: (_ctx, doc) => {
			if (doc.role === 'editor') return { role: 'moderator' };
		},
	},
});
