import { getAuth } from '@/kit/auth';

import { ModeToggle } from '../mode-toggle';
import { BackHome } from './back-home';
import { UserOptions } from './user-options';

export const MainNav = async () => {
	const { user } = await getAuth();

	return (
		<div className='border-b py-3 flex items-center justify-between'>
			<BackHome />
			<div className='flex items-center gap-4'>
				<UserOptions email={user?.email} />
				<ModeToggle />
			</div>
		</div>
	);
};
