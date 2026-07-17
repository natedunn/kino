import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/account/security/')({
	head: () => ({
		meta: [titleMeta(['Security', 'Account'])],
	}),
	loader: async ({ context }) => {
		if (!context.loaderToken) {
			return;
		}

		await context.queryClient.ensureQueryData(
			crpcServer.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
		);
	},
	// Auth entry is gated by the parent `/account` route's `beforeLoad`, and
	// in-place sign-out by its `AccountRoute` guard — no child guard needed.
	component: AuthenticatedSecurityRoute,
});

function AuthenticatedSecurityRoute() {
	const crpc = useCRPC();
	const profileQuery = useSuspenseQuery(
		crpc.profile.findMyProfile.queryOptions({}, { skipUnauth: true })
	);
	const profile = profileQuery.data;

	if (!profile) {
		return null;
	}

	return (
		<section className='flex max-w-3xl flex-col gap-6'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>Security</h2>
				<p className='mt-1 text-sm text-muted-foreground'>
					Manage the email and security settings for your account.
				</p>
			</header>

			<div className='rounded-xl border bg-card'>
				<div className='flex flex-col gap-6 p-6'>
					<div className='flex flex-col gap-2'>
						<LabelWrapper>
							<Label>Email</Label>
							<LabelDescription>The email address associated with your account.</LabelDescription>
						</LabelWrapper>
						<Input disabled value={profile.email ?? ''} />
					</div>
				</div>
			</div>

			<div className='rounded-xl border border-destructive/40 bg-card'>
				<div className='flex flex-col gap-1 p-6'>
					<h3 className='font-semibold text-destructive'>Danger zone</h3>
					<p className='text-sm text-muted-foreground'>
						Permanently delete your account and all associated data. This action cannot be undone.
					</p>
				</div>
				<div className='flex items-center justify-end border-t border-destructive/40 bg-destructive/5 px-6 py-4'>
					<Button disabled variant='destructive'>
						Delete account
					</Button>
				</div>
			</div>
		</section>
	);
}
