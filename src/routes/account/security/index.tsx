import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { Label, LabelDescription, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';
import { m } from '@/paraglide/messages.js';

export const Route = createFileRoute('/account/security/')({
	head: () => ({
		meta: [titleMeta([m.account_security(), m.account_title()])],
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
				<h2 className='text-xl font-semibold'>{m.account_security()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.security_description()}</p>
			</header>

			<div className='rounded-xl border bg-card'>
				<div className='flex flex-col gap-6 p-6'>
					<div className='flex flex-col gap-2'>
						<LabelWrapper>
							<Label>{m.common_email()}</Label>
							<LabelDescription>{m.security_email_description()}</LabelDescription>
						</LabelWrapper>
						<Input disabled value={profile.email ?? ''} />
					</div>
				</div>
			</div>

			<div className='rounded-xl border border-destructive/40 bg-card'>
				<div className='flex flex-col gap-1 p-6'>
					<h3 className='font-semibold text-destructive'>{m.security_danger_zone()}</h3>
					<p className='text-sm text-muted-foreground'>{m.security_delete_description()}</p>
				</div>
				<div className='flex items-center justify-end border-t border-destructive/40 bg-destructive/5 px-6 py-4'>
					<Button disabled variant='destructive'>
						{m.security_delete_account()}
					</Button>
				</div>
			</div>
		</section>
	);
}
