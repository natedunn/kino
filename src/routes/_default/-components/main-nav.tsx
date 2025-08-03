import { Link } from '@tanstack/react-router';
import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';

import { API } from '@/lib/api';

import { ProfileDropdown } from './profile-dropdown';
import ThemeToggle from './theme-toggle';

type MainNavProps = {
	user: API['user']['getUserIndexes'] | null | undefined;
};

export const MainNav = ({ user }: MainNavProps) => {
	return (
		<div className='border-b border-border'>
			{/* <div className='container'> */}
			<nav className='flex items-center justify-between'>
				<div className='-ml-12 flex items-center overflow-y-hidden py-4 pl-12'>
					<Link
						to='/'
						className='group ml-2 bg-primary/10 px-3 py-1 decoration-primary/50 decoration-2 underline-offset-2 hover:bg-primary/20 hover:underline'
					>
						<span className='text-sm font-bold text-primary uppercase transition-all group-hover:scale-105'>
							Kino
						</span>
					</Link>
				</div>
				<div className='flex items-center gap-4'>
					<AuthLoading>Loading...</AuthLoading>
					<Authenticated>
						<ProfileDropdown user={user!} />
					</Authenticated>
					<Unauthenticated>
						<Link className='link-text' to='/sign-in'>
							Sign In
						</Link>
					</Unauthenticated>
					<ThemeToggle />
				</div>
			</nav>
			{/* </div> */}
		</div>
	);
};
