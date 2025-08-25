import React from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '~api';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/auth/auth-client';

export const TeamSelector = ({ activeTeamId }: { activeTeamId: string | undefined }) => {
	const { data } = useSuspenseQuery(convexQuery(api.user.getTeamList, {}));

	const handleChange = async (id: string) => {
		const { error } = await authClient.organization.setActive({
			organizationId: id,
		});

		if (error) {
			toast.error('Unable to change active team');
		} else {
			toast.success('Successfully changed active team');
		}
	};

	React.useEffect(() => {
		console.log('data', data);
		console.log('activeTeamId', activeTeamId);
	}, [activeTeamId, data]);

	const value = activeTeamId ?? data?.teams[0]?.id;

	return (
		<div>
			<Select value={value} onValueChange={handleChange}>
				<SelectTrigger className='w-[180px]'>
					<SelectValue placeholder='Select Team' />
				</SelectTrigger>
				<SelectContent>
					{value &&
						data?.teams.map((team) => (
							<SelectItem key={team.id} value={team.id}>
								{team.name}
							</SelectItem>
						))}
				</SelectContent>
			</Select>
		</div>
	);
};
