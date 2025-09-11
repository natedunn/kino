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

export const OrgSelector = ({ activeOrgId }: { activeOrgId: string | undefined }) => {
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

	return (
		<div>
			<Select value={activeOrgId ?? undefined} onValueChange={handleChange}>
				<SelectTrigger className='w-[180px]'>
					<SelectValue placeholder='Select Team' />
				</SelectTrigger>
				<SelectContent>
					{data?.teams.map((team) => (
						<SelectItem key={team.id} value={team.id}>
							{team.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};
