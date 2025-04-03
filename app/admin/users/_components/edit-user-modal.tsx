import type { API } from '@/kit/api/app-router';
import type { ArraySingle } from '@/kit/types/utils';
import type { DialogProps } from '@radix-ui/react-dialog';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
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

export const EditUserModal = ({
	initialData,
	dialogProps,
	onSave,
}: {
	initialData: QueriedUser;
	dialogProps: DialogProps;
	onSave?: () => void;
}) => {
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

	const form = useAppForm({
		validators: {
			onChange: userSchema.read.pick({
				id: true,
				username: true,
				email: true,
				role: true,
			}),
		},
		defaultValues: initialData,
		onSubmit: ({ value }) => {
			console.log(value);
			updateUserMutation({
				...value,
				prevEmail: initialData.email,
			});
		},
	});

	const handleSubmit = useCallback(
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
