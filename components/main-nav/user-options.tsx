'use client';

import React from 'react';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation';

import { Link } from '../link';

const { signOut } = createAuthClient();

export const UserOptions = ({ identifier }: { identifier?: string }) => {
	const router = useRouter();

	return (
		<React.Fragment>
			{identifier ? (
				<button
					className='link-as-text'
					onClick={async () => {
						await signOut();
						router.refresh();
					}}
				>
					Sign out <span className='hidden md:inline'>({identifier})</span>
				</button>
			) : (
				<Link className='link-as-text' href='/sign-in'>
					Sign in
				</Link>
			)}
		</React.Fragment>
	);
};
