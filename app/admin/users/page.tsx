import { adminGuard } from '../lib/admin-guard';
import { UsersTable } from './_components/users-table';

export default async function AdminUsersPage() {
	await adminGuard();

	return (
		<div>
			<UsersTable />
		</div>
	);
}
