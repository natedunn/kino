import { Link } from '@/components/link';

import { adminGuard } from './lib/admin-guard';

export default async function AdminPage() {
	await adminGuard();
	return (
		<div>
			<h1>Hello admin!</h1>
			<ul>
				<li>
					<Link href='/users'>Users</Link>
				</li>
			</ul>
		</div>
	);
}
