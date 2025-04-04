'use client';

import type { API } from '@/kit/api/app-router';
import type { ArraySingle } from '@/kit/types/utils';
import type { ColumnDef } from '@tanstack/react-table';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';

import { DataTable } from '@/components/data-table';
import { DataTableColumnHeader } from '@/components/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table-toolbar';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/kit/api/fetcher/client';
import { useDataTable } from '@/lib/hooks/use-data-table';
import { useDialog } from '@/lib/hooks/use-dialog';

import { EditUserModal } from './edit-user-modal';

type QueriedUser = ArraySingle<API['output']['admin']['listAllUsers']['users']>;

export const UsersTable = () => {
	const trpc = useTRPC();

	const { data, status, error, refetch } = useQuery(trpc.admin.listAllUsers.queryOptions());

	const columns = React.useMemo<ColumnDef<NonNullable<QueriedUser>>[]>(
		() => [
			{
				id: 'username',
				accessorKey: 'username',
				header: ({ column }) => {
					return <DataTableColumnHeader column={column} title='Username' />;
				},
				cell: ({ row }) => {
					return <div>{row.getValue('username')}</div>;
				},
				meta: {
					label: 'Username',
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				id: 'email',
				accessorKey: 'email',
				header: ({ column }) => {
					return <DataTableColumnHeader column={column} title='Email' />;
				},
				meta: {
					label: 'Email',
				},
				enableSorting: false,
			},
			{
				id: 'role',
				accessorKey: 'role',
				header: ({ column }) => {
					return <DataTableColumnHeader column={column} title='Role' />;
				},
				meta: {
					label: 'Role',
				},
				enableSorting: false,
			},
			{
				id: 'providerId',
				accessorKey: 'providerId',
				header: ({ column }) => {
					return <DataTableColumnHeader column={column} title='Provider ID' />;
				},
				cell: ({ row }) => {
					if (!row.getValue('providerId')) {
						return <div>n/a</div>;
					}
					return <div>{row.getValue('providerId')}</div>;
				},
				meta: {
					label: 'Provider ID',
				},
			},
			{
				id: 'action',
				accessorKey: 'action',
				header: ({ column }) => {
					return <DataTableColumnHeader column={column} title='Action' />;
				},
				cell: function Cell({ row }) {
					const editDialog = useDialog();

					if (!row.original) return null;

					return (
						<>
							<Button variant='outline' size='sm' onClick={editDialog.trigger}>
								<Pencil className='!size-3' />
								<span>Edit</span>
							</Button>
							<EditUserModal
								onSave={() => {
									editDialog.trigger();
									refetch();
								}}
								initialData={{
									id: row.original.id,
									username: row.original.username,
									role: row.original.role,
									email: row.original.email,
								}}
								dialogProps={editDialog.props}
							/>
						</>
					);
				},
				enableSorting: false,
				enableColumnFilter: false,
				enableHiding: false,
				size: 40,
			},
		],
		[refetch]
	);

	const { table } = useDataTable({
		data: [...(data?.users ?? [])],
		columns,
		pageCount: 1,
		getRowId: (row) => row.id,
	});

	if (status === 'error') {
		return <div>Error: {error.message}</div>;
	}

	if (status === 'pending') {
		return <div>Loading users...</div>;
	}

	return (
		<div className='data-table-container'>
			<DataTable table={table}>
				<DataTableToolbar table={table}>
					{/* <DataTableSortList table={table} /> */}
				</DataTableToolbar>
			</DataTable>
		</div>
	);
};
