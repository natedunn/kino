import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

import { findMembership } from './access';

// Memoized author reads for one query call. A thread repeats the same few
// authors, so each profile and each "Team" membership check is read once.
// Team means any membership in the project's organization (owner, admin or
// moderator), the same rule the Updates comments use.
export function commentAuthors(ctx: QueryCtx, organizationId: Id<'organizations'> | null) {
	const profiles = new Map<Id<'profiles'>, Promise<Doc<'profiles'> | null>>();
	const team = new Map<Id<'users'>, Promise<boolean>>();
	return {
		profile(id: Id<'profiles'>) {
			let result = profiles.get(id);
			if (!result) {
				result = ctx.db.get('profiles', id);
				profiles.set(id, result);
			}
			return result;
		},
		isTeamMember(profile: Doc<'profiles'> | null) {
			if (!profile || !organizationId) return Promise.resolve(false);
			let result = team.get(profile.userId);
			if (!result) {
				result = findMembership(ctx, organizationId, profile.userId).then(
					(membership) => !!membership
				);
				team.set(profile.userId, result);
			}
			return result;
		},
	};
}

export type CommentAuthors = ReturnType<typeof commentAuthors>;
