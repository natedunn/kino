import { AdminDataFetcher } from './admin-data-fetcher';

export default async function AdminPage() {
	return (
		<div>
			<div className='space-y-6'>
				<h1 className='text-3xl font-bold'>Admin Procedure</h1>
				<p className='mt-2'>
					Below is returned data from the admin procedure. It only returns said data if you (the
					user) are authenticated and have the role of admin.
				</p>
				<p>
					Before creating an account, make sure to add the <span className='code'>ADMIN_EMAIL</span>{' '}
					to the <span className='code'>.env</span> file. If this matches the authenticated
					user&apos;s Github email, then the role will automatically be set to{' '}
					<span className='code'>admin</span>. In any case, you may still make the change manually
					in the database.
				</p>
				<p>
					Note: this data is fetched on the client as means of demonstrating client side fetching,
					via tRPC + Tanstack Query.
				</p>
			</div>
			<pre className='mt-6 code code-box'>
				<code>
					<AdminDataFetcher />
				</code>
			</pre>
		</div>
	);
}
