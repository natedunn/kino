import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useMutation as convexMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import * as z from 'zod';

import { API, api } from '~api';
import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelWrapper } from '@/components/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import { updateProfileSchema } from '@/convex/schema/profile.schema';
import { updateUserSchema } from '@/convex/schema/user.schema';
import { cn } from '@/lib/utils';

const formSchema = z.object({
	profile: updateProfileSchema,
	user: updateUserSchema,
	files: z.instanceof(File).array().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

type UserEditFormProps = {
	profile: NonNullable<API['profile']['findMyProfile']>;
};

export const UserEditForm = ({ profile }: UserEditFormProps) => {
	const generateUserUploadUrl = convexMutation(api.profile.generateUserUploadUrl);
	const syncMetadata = convexMutation(api.profile.syncMetadata);

	const [formError, setFormError] = React.useState<string | null>(null);

	const { mutate: updateUser } = useMutation({
		mutationFn: useConvexMutation(api.profile.update),
		onSuccess: () => form.reset(),
		onError: (error) => {
			if (error instanceof ConvexError) {
				setFormError(error.data.message);
			}
		},
	});

	async function handleUpload(files: File[]) {
		const { url, key } = await generateUserUploadUrl({
			type: 'PFP',
		});

		await fetch(url, {
			method: 'PUT',
			body: files[0],
		});

		await syncMetadata({ key });
	}

	const defaultValues: FormSchema = {
		profile: {},
		user: {
			username: profile.username,
			name: profile.name,
		},
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			setFormError(null);

			const { files, ...rest } = value;

			if (files) {
				await handleUpload(files);
				formApi.reset();
			}

			updateUser({
				identifiers: {
					userId: profile.userId,
					_id: profile._id,
				},
				profile: rest.profile,
				user: rest.user,
			});
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className='flex flex-col gap-6'
		>
			<form.Field name='files'>
				{(field) => {
					return (
						<div className='flex items-end gap-3'>
							<div className='flex flex-1 flex-col gap-2'>
								<LabelWrapper>
									<Label>Avatar</Label>
								</LabelWrapper>
								<div className='flex items-center gap-4'>
									{(field.state.value || profile.imageUrl) && (
										<Avatar className='size-16 rounded-lg'>
											<AvatarImage
												src={
													field.state.value?.[0]
														? URL.createObjectURL(field.state.value[0])
														: profile.imageUrl
												}
												alt={profile.name}
											/>
											<AvatarFallback className='rounded-lg'>{profile.name?.[0]}</AvatarFallback>
										</Avatar>
									)}
									<div className='flex items-center'>
										<Input
											type='file'
											className='h-auto! py-4 file:h-auto file:leading-4 hocus:bg-accent/50'
											onChange={(e) => {
												if (e.target.files) {
													field.handleChange([e.target.files[0]]);
												}
											}}
										/>
									</div>
								</div>
							</div>
						</div>
					);
				}}
			</form.Field>

			<form.Field name='user.username'>
				{(field) => {
					return (
						<div className='flex items-end gap-3'>
							<div className='flex flex-1 flex-col gap-2'>
								<LabelWrapper>
									<Label>Username</Label>
								</LabelWrapper>
								<Input
									value={String(field.state.value)}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						</div>
					);
				}}
			</form.Field>

			<form.Field name='user.name'>
				{(field) => {
					return (
						<div className='flex items-end gap-3'>
							<div className='flex flex-1 flex-col gap-2'>
								<LabelWrapper>
									<Label>Name</Label>
								</LabelWrapper>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						</div>
					);
				}}
			</form.Field>

			<div className='flex items-end gap-3'>
				<div className='flex flex-1 flex-col gap-2'>
					<LabelWrapper>
						<Label>Email</Label>
					</LabelWrapper>
					<Input value={profile.email} disabled />
				</div>
			</div>

			{!!formError && <InlineAlert variant='danger'>{formError}</InlineAlert>}

			<div className='flex items-center gap-2'>
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Button
							type='submit'
							className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
						>
							{isSubmitting ? 'Updating...' : 'Update'}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
};
