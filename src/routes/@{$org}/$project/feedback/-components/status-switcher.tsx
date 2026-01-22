import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Id } from '@/convex/_generated/dataModel';
import { StatusIcon } from '@/icons';
import { cn } from '@/lib/utils';

export type FeedbackStatus = 'open' | 'in-progress' | 'closed' | 'completed' | 'paused';

const STATUS_CONFIG: Record<FeedbackStatus, { label: string }> = {
	open: { label: 'Open' },
	'in-progress': { label: 'In Progress' },
	closed: { label: 'Closed' },
	completed: { label: 'Completed' },
	paused: { label: 'Paused' },
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
			<span className='flex items-center gap-1.5 text-sm'>
				<StatusIcon status={currentStatus} size='14' colored />
				{config.label}
			</span>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					disabled={isUpdating}
					className='h-auto gap-1.5 px-2 py-1 text-xs'
				>
					<StatusIcon status={currentStatus} size='14' colored />
					{isUpdating ? 'Updating...' : config.label}
					<ChevronDown size={12} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{(Object.keys(STATUS_CONFIG) as FeedbackStatus[]).map((status) => (
					<DropdownMenuItem
						key={status}
						onClick={() => handleStatusChange(status)}
						className='cursor-pointer gap-2'
					>
						<StatusIcon status={status} size='14' colored />
						<span className='flex-1'>{STATUS_CONFIG[status].label}</span>
						{status === currentStatus && <Check size={14} className='text-primary' />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
