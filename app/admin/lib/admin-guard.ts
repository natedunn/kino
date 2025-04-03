import { notFound } from 'next/navigation';

import { getAuth } from '@/kit/auth';

export const adminGuard = async () => {
	const { user } = await getAuth();

	if (user?.role && user.role !== 'admin') {
		return notFound();
	}
};
