import React from 'react';

import { Link } from '@/components/link';

export default async function HomePage() {
	const links = [
		{
			text: '/start',
			href: '/start',
			description: () => <span>Some helpful tip and information on how to get started.</span>,
		},
		{
			text: '/sign-in',
			href: '/sign-in',
			description: () => <span>Sign in to an account (Github keys required)</span>,
		},
		{
			text: '/open',
			href: '/open?exampleString=Hello%20world%20from%20server',
			description: () => (
				<span>View data fetched from an open procedure. Pass data via search params.</span>
			),
		},
		{
			text: '/authed',
			href: '/authed?exampleString=Hello%20world%20from%20server',
			description: () => (
				<span>
					View data fetched from an authed procedure. Pass data via search params. Use{' '}
					<span className='code'>redirect=false</span> to see API error.
				</span>
			),
		},
		{
			text: '/admin',
			href: '/admin',
			description: () => (
				<span>
					View user list data fetched from an admin procedure. Only authenticated users with the
					admin role have access.
				</span>
			),
		},
	];

	return (
		<React.Fragment>
			<div>
				<h1 className='text-3xl font-bold'>next-kit by @natedunn</h1>
				<p className='mt-2 text-muted-foreground'>
					<span className='italic'>&quot;Measure twice, cut once&quot;</span>{' '}
					<span>— Wayne Gretzky — Nate Dunn</span>
				</p>
			</div>
			<div className='mt-6 pt-4 border-t'>An index of pages:</div>
			<table className='mt-4'>
				<tbody>
					{links.map((link) => (
						<tr key={link.href} className='border bg-muted/50'>
							<td className='border-r px-5 py-3 font-mono no-wrap-cell'>
								<Link className='hover:underline' href={link.href}>
									{link.text}
								</Link>{' '}
							</td>
							<td className='text-muted-foreground px-4 py-2 text-sm'>{link.description()}</td>
						</tr>
					))}
				</tbody>
			</table>
		</React.Fragment>
	);
}
