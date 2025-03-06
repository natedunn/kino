import React from 'react';

import { Link } from '@/components/link';

export default async function SetupPage() {
	return (
		<React.Fragment>
			<div className='border-b pb-4 mb-4'>
				<h1 className='text-3xl font-bold'>Start</h1>
				<p className='mt-2'>A few things to get started.</p>
			</div>
			<div className='prose dark:prose-invert'>
				<h3>Why another starter kit?</h3>
				<p>I build a lot, but I hate recreating boilerplate code.</p>
				<p>
					I also wanted a separation between the boilerplate code and the actual logic that is
					specific to application, so I moved a lot of that into the{' '}
					<span className='code'>.kit</span> folder
				</p>
				<hr className='solid' />
				<h3>Whats in the stack?</h3>
				<ul>
					<li>Next.js</li>
					<li>TypeScript</li>
					<li>Tailwind CSS</li>
				</ul>
				<h4>Libraries and integrations</h4>
				<ul>
					<li>tRPC — API</li>
					<li>Better Auth — authentication</li>
					<li>Drizzle ORM (default driver w/ Neon DB) — Database ORM</li>
					<li>Nuqs — search params</li>
					<li>T3 Env — type-safe ENV variables</li>
					<li>Shadcn ready — components</li>
				</ul>
				<hr className='solid'></hr>
				<h3>Features</h3>
				<ul>
					<li>Authentication</li>
					<li>Type-safe API procedures</li>
					<li>Basic authorization w/ API middleware</li>
					<li>Admin roles (w/ authorization)</li>
					<li>Type-safe search params</li>
					<li>
						A few small things that I really hate setting up every time for new projects but feel
						kind of important to do.
					</li>
				</ul>
				<hr className='solid'></hr>
				<h3>Instructions</h3>
				<h4>Required</h4>
				<ul>
					<li>
						Enable auth by adding Github client info to <span className='code'>.env</span> file.
					</li>
					<li>
						The Neon DB driver is pre-configured. If this is not your preferred DB provider, you
						will need to change the{' '}
						<Link className='link-as-text' href='https://orm.drizzle.team/docs/get-started'>
							different driver
						</Link>
						.
					</li>
				</ul>
				<h4>Suggestions</h4>
				<ul>
					<li>
						Add better-auth plugins before running <span className='code'>pnpm db:auth</span> to
						update schema.
					</li>
				</ul>
			</div>
		</React.Fragment>
	);
}
