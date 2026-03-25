import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { useConvexAuth } from 'convex/react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth/auth-client';

const searchValidator = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute('/_blank/sign-in')({
	validateSearch: searchValidator,
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { isAuthenticated, isLoading } = useConvexAuth();

	if (isLoading) {
		return null;
	}

	if (isAuthenticated) {
		return <Navigate to='/' />;
	}

	return (
		<div className='flex h-screen flex-col items-center justify-center'>
			<div className='rounded-lg border border-border bg-background p-6 md:p-8 dark:border-white/25 dark:bg-muted/50'>
				<div className='flex flex-col gap-4'>
					<Button
						onClick={async () => {
							await authClient.signIn.social({
								provider: 'github',
								callbackURL: search.redirect,
							});
						}}
					>
						Sign in
					</Button>
					<div>
						<Separator className='mb-4' />
						<Link
							to='/'
							className='flex items-center gap-2 text-sm text-muted-foreground decoration-foreground/50 decoration-2 underline-offset-2 hover:underline'
						>
							<ChevronLeft size={14} />
							<span>Or go back</span>
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
