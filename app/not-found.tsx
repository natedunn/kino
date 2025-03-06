import { Link } from '@/components/link';

export default async function NotFoundPage() {
	return (
		<div className='flex flex-col items-center justify-center h-screen'>
			<div className='text-3xl font-bold'>404 - Not Found</div>
			<div>
				This page does not exist.{' '}
				<Link className='link-as-text' href='/'>
					Go back home
				</Link>
				.
			</div>
		</div>
	);
}
