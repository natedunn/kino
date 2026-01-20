import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

export type FeedbackStatus = 'open' | 'in-progress' | 'closed' | 'completed' | 'paused';

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; className: string }> = {
	open: { label: 'Open', className: 'bg-blue-700/50 text-blue-100' },
	'in-progress': { label: 'In Progress', className: 'bg-purple-700/50 text-purple-100' },
	closed: { label: 'Closed', className: 'bg-red-700/50 text-red-100' },
	completed: { label: 'Completed', className: 'bg-green-700/50 text-green-100' },
	paused: { label: 'Paused', className: 'bg-orange-700/50 text-orange-100' },
};

type StatusSwitcherProps = {
	feedbackId: Id<'feedback'>;
	currentStatus: FeedbackStatus;
	canEdit: boolean;
};

export function StatusSwitcher({ feedbackId, currentStatus, canEdit }: StatusSwitcherProps) {
	const { mutate: updateStatus, status: mutationStatus } = useMutation({
		mutationFn: useConvexMutation(api.feedback.updateStatus),
	});

	const isUpdating = mutationStatus === 'pending';
	const config = STATUS_CONFIG[currentStatus];

	const handleStatusChange = (newStatus: FeedbackStatus) => {
		if (newStatus !== currentStatus) {
			updateStatus({ _id: feedbackId, status: newStatus });
		}
	};

	if (!canEdit) {
		return (
			<span className={cn(config.className, 'inline-block px-1.5 py-0.5 text-xs')}>
				{config.label}
			</span>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='ghost'
					size='sm'
					disabled={isUpdating}
					className={cn(config.className, 'h-auto gap-1 px-1.5 py-1 text-xs hover:opacity-80')}
				>
					{isUpdating ? 'Updating...' : config.label}
					<ChevronDown size={12} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{(Object.keys(STATUS_CONFIG) as FeedbackStatus[]).map((status) => (
					<DropdownMenuItem
						key={status}
						onClick={() => handleStatusChange(status)}
						className={cn('cursor-pointer', {
							'font-semibold': status === currentStatus,
						})}
					>
						<span
							className={cn(
								STATUS_CONFIG[status].className,
								'mr-2 inline-block rounded px-1.5 py-1 text-xs'
							)}
						>
							{STATUS_CONFIG[status].label}
						</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
