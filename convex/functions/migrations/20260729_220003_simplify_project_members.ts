import { asId } from '../../lib/kino';
import { defineMigration } from '../generated/migrations.gen';

export const migration = defineMigration({
	id: '20260729_220003_simplify_project_members',
	description: 'Delete org-derived project rows and unset the legacy direct-member role',
	up: {
		table: 'projectMember',
		migrateOne: async (ctx, doc) => {
			if (doc.role === 'org:admin' || doc.role === 'org:editor') {
				if (doc.id) {
					await ctx.db.delete('projectMember', asId<'projectMember'>(doc.id));
				}
				return;
			}
			if (doc.role === 'member') return { role: undefined };
		},
	},
});
