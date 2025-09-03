import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';

import { api } from '~api';
import { Id } from '@/convex/_generated/dataModel';

export const useAuth = ({ userId }: { userId: Id<'user'> | null }) => {
	const { data: user } = useSuspenseQuery(
		convexQuery(api.user.get, {
			_id: userId,
		})
	);

	return {
		user,
	};
};
