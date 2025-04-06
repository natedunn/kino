import type { API } from '@/kit/api/app-router';
import type { ArraySingle } from '@/kit/types/utils';
import type { DialogProps } from '@radix-ui/react-dialog';

import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { useAppForm } from '@/components/ui/tanstack-form';
import { useTRPC } from '@/kit/api/fetcher/client';
import { log } from '@/kit/utils';
import { userSchema } from '@/lib/db/schema/auth';

type QueriedUser = NonNullable<ArraySingle<API['output']['admin']['listAllUsers']['users']>>;

export const EditUserDialog = ({
	initialData,
	dialogProps,
	onSave,
}: {
	initialData: QueriedUser;
	dialogProps: DialogProps;
	onSave?: () => void;
}) => {
	const [code] = React.useState(() => Math.random().toString(36).slice(2));
	const [enteredCode, setEnteredCode] = React.useState('');

	const trpc = useTRPC();

	const {
		mutate: updateUserMutation,
		isPending,
		isError,
	} = useMutation(
		trpc.admin.updateUser.mutationOptions({
			onSuccess: () => {
				toast.success('User updated successfully');
				onSave?.();
			},
			onError: (error) => {
				log.warn(error);
				toast.error(error.message);
			},
		})
	);

	const { mutate: banUserMutation } = useMutation(
		trpc.admin.banUser.mutationOptions({
			onSuccess: () => {
				toast.success('User banned successfully');
			},
			onError: (error) => {
				log.warn(error);
				toast.error(error.message);
			},
		})
	);

	const form = useAppForm({
		validators: {
			onChange: userSchema.read.pick({
				id: true,
				username: true,
				email: true,
				role: true,
				banned: true,
			}),
		},
		defaultValues: initialData,
		onSubmit: ({ value }) => {
			updateUserMutation({
				...value,
				prevEmail: initialData.email,
			});
		},
	});

	const handleSubmit = React.useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			e.stopPropagation();
			form.handleSubmit();
		},
		[form]
	);

	return (
		<Sheet {...dialogProps}>
			<SheetContent className='w-full max-w-lg' forceMount={true}>
				<SheetHeader>
					<SheetTitle>Edit User</SheetTitle>
					<SheetDescription>Edit user details</SheetDescription>
					<div className='mt-6'>
						<form.AppForm>
							<form className='space-y-6' onSubmit={handleSubmit}>
								<form.AppField name='username'>
									{(field) => (
										<field.FormItem>
											<field.FormLabel>Username</field.FormLabel>
											<field.FormDescription>Unique display name.</field.FormDescription>
											<field.FormControl>
												<Input
													placeholder=''
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
													autoFocus={true}
												/>
											</field.FormControl>
											<field.FormMessage />
										</field.FormItem>
									)}
								</form.AppField>
								<form.AppField name='email'>
									{(field) => (
										<field.FormItem>
											<field.FormLabel>Email</field.FormLabel>
											<field.FormDescription>Unique email address.</field.FormDescription>
											<field.FormControl>
												<Input
													placeholder=''
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
												/>
											</field.FormControl>
											<field.FormMessage />
										</field.FormItem>
									)}
								</form.AppField>
								<form.AppField name='role'>
									{(field) => (
										<field.FormItem>
											<field.FormLabel>Role</field.FormLabel>
											<field.FormDescription>
												Danger: this effects many things.
											</field.FormDescription>
											<field.FormControl>
												<Select
													value={field.state.value}
													onValueChange={(value) =>
														field.handleChange(value as QueriedUser['role'])
													}
													defaultValue='user'
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{/* 🟡 TODO: maybe make this automatic based on constants */}
														<SelectItem value={'admin' satisfies QueriedUser['role']}>
															Admin
														</SelectItem>
														<SelectItem value={'member' satisfies QueriedUser['role']}>
															Member
														</SelectItem>
													</SelectContent>
												</Select>
											</field.FormControl>
											<field.FormMessage />
										</field.FormItem>
									)}
								</form.AppField>
								<div>
									<div className='mb-2 space-y-2'>
										<Label>Ban User</Label>
										<div className='text-muted-foreground text-sm'>
											Type <span className='font-mono border p-0.5'>{code}</span> to confirm
										</div>
									</div>
									<div className='flex gap-2 items-center'>
										<Input placeholder={code} onChange={(e) => setEnteredCode(e.target.value)} />
										<Button
											disabled={code !== enteredCode}
											type='button'
											variant='destructive'
											onClick={() => {
												if (code === enteredCode) {
													banUserMutation({
														userId: initialData.id,
													});
												}
											}}
										>
											Ban
										</Button>
									</div>
								</div>
								<Separator />
								<div className='flex gap-4 flex-wrap items-center justify-between'>
									<Button type='submit' disabled={isPending}>
										{isPending ? 'Saving...' : 'Save'}
									</Button>
									<div className='flex items-center  text-sm'>
										{isError && !isPending ? (
											<span className='inline-block bg-destructive text-destructive-foreground rounded py-1 px-2'>
												Unable to save.
											</span>
										) : null}
									</div>
								</div>
							</form>
						</form.AppForm>
					</div>
				</SheetHeader>
			</SheetContent>
		</Sheet>
	);
};
