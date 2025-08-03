import { projectSchema } from '../schema';
import { procedure } from './procedure';

export const create = procedure.authed.external.mutation({
	args: {},
	handler: async (ctx, args) => {
		return {
			success: true,
		};
	},
});
