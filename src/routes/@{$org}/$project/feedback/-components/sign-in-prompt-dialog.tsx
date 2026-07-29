import type { ReactNode } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { Bell, ChevronUp, SmilePlus, X as XIcon } from 'lucide-react';

import { GradientIconBadge } from '@/components/gradient-icon-badge';
import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogClose,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';

type SignInPromptAction = 'follow' | 'react' | 'upvote';

// Copy + hero icon per action. The dialog is opened when a signed-out visitor
// tries to upvote, follow, or react, so the messaging nudges them toward an
// account.
const ACTION_COPY: Record<
	SignInPromptAction,
	{ description: string; icon: ReactNode; title: string }
> = {
	follow: {
		description: 'Sign in to follow this feedback and get notified when it changes.',
		icon: <Bell className='size-6' />,
		title: 'Sign in to follow',
	},
	react: {
		description: 'Create a free account to react to comments and join the discussion.',
		icon: <SmilePlus className='size-6' />,
		title: 'Sign in to react',
	},
	upvote: {
		description: 'Create a free account to upvote feedback and help shape what gets built next.',
		icon: <ChevronUp className='size-6' />,
		title: 'Sign in to upvote',
	},
};

export function SignInPromptDialog({
	action,
	onOpenChange,
	open,
}: {
	action: SignInPromptAction;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	// Return the visitor to the page they were on once they finish authenticating.
	const redirect = useRouterState({ select: (state) => state.location.pathname });
	const copy = ACTION_COPY[action];

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='sm:max-w-sm'
				showCloseButton={false}
			>
				<div className='relative flex flex-col items-center gap-5 px-6 py-8 text-center'>
					<ResponsiveDialogClose
						render={<Button className='absolute top-3 right-3' size='icon-sm' variant='ghost' />}
					>
						<XIcon className='size-4' />
						<span className='sr-only'>Close</span>
					</ResponsiveDialogClose>

					<GradientIconBadge>{copy.icon}</GradientIconBadge>

					<div className='flex flex-col gap-1.5'>
						<ResponsiveDialogTitle className='text-lg font-semibold tracking-tight'>
							{copy.title}
						</ResponsiveDialogTitle>
						<ResponsiveDialogDescription className='text-sm text-balance text-muted-foreground'>
							{copy.description}
						</ResponsiveDialogDescription>
					</div>

					<div className='flex w-full flex-col gap-2'>
						<Button asChild size='lg'>
							<Link search={{ redirect }} to='/auth'>
								Sign in
							</Link>
						</Button>
						<Button asChild size='lg' variant='outline'>
							<Link to='/auth/sign-up'>Create account</Link>
						</Button>
					</div>
				</div>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}
