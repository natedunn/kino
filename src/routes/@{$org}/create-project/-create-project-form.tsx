import React from 'react';
import { useConvexMutation } from '@convex-dev/react-query';
import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeClosed } from 'lucide-react';
import * as z from 'zod';

import { api } from '~api';
import { InlineAlert } from '@/components/inline-alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input-shadcn';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select-shadcn';
import { useAppForm, useFormError } from '@/components/ui/tanstack-form';
import { createProjectSchema } from '@/convex/schema/project.schema';
import { cn } from '@/lib/utils';

const formSchema = createProjectSchema;

type FormSchema = z.infer<typeof formSchema>;

type CreateProjectFormProps = {
	enabled: boolean;
	orgSlug: string;
	orgName: string;
};

export const CreateProjectForm = ({ enabled, orgSlug, orgName }: CreateProjectFormProps) => {
	const navigate = useNavigate();
	const formError = useFormError();

	const { mutate: createProject } = useMutation({
		mutationFn: useConvexMutation(api.project.create),
		onSuccess: () => {
			form.reset();

			navigate({
				to: '/@{$org}/$project',
				params: {
					org: orgSlug,
					project: projectSlug,
				},
			});
		},
		onError: formError.setError,
	});

	const defaultValues: FormSchema = {
		name: '',
		slug: '',
		visibility: 'public',
		orgSlug,
	};

	const form = useAppForm({
		defaultValues,
		validators: {
			onSubmit: formSchema,
		},
		validationLogic: revalidateLogic({
			mode: 'submit',
			modeAfterSubmission: 'change',
		}),
		onSubmitInvalid: () => {
			formError.errorReset();
		},
		onSubmit: async ({ value }) => {
			formError.errorReset();
			createProject({
				name: value.name,
				slug: value.slug,
				visibility: value.visibility,
				orgSlug: value.orgSlug,
			});
		},
	});

	const projectSlug = useStore(form.store, (state) => state.values.slug);
	const name = useStore(form.store, (state) => state.values.name);
	const visibility = useStore(form.store, (state) => state.values.visibility);

	return (
		<div className='grid h-full grid-cols-12'>
			<div className='col-span-3 border-r'>
				<div className='relative flex flex-col pr-6'>
					<div className='relative z-10 mx-auto rounded-b-lg bg-foreground/10 px-2 py-0.5 text-sm text-muted-foreground'>
						Preview
					</div>
					<div className='absolute inset-x-0 top-0 h-64 bg-linear-to-tr from-background to-foreground/10'></div>
					<div className='z-10 flex w-full flex-col items-center justify-center pt-10'>
						<div>
							<Avatar className='size-24 border'>
								<AvatarFallback className='rounded-lg text-xl font-bold'>
									{name?.[0]?.toUpperCase() ?? '?'}
								</AvatarFallback>
							</Avatar>
						</div>
						<div
							className={cn('mt-3 w-full text-center text-2xl font-bold', {
								'text-muted-foreground': !enabled || !name,
							})}
						>
							{!!name ? name : 'Unnamed'}
						</div>
						<div className='mt-1 flex items-center gap-1 text-sm'>
							{visibility === 'public' ? (
								<>
									<Eye className='size-4' />
									<span>Public</span>
								</>
							) : (
								<>
									<EyeClosed className='size-4' />
									<span>Private</span>
								</>
							)}
						</div>
						<div className='mt-3 rounded-lg border bg-muted px-1 py-0.5 text-sm'>
							<span className='text-muted-foreground'>@{orgSlug}/</span>
							<span className='text-foreground'>{!!projectSlug ? projectSlug : '...'}</span>
						</div>
					</div>
				</div>
			</div>
			<div className='col-span-9 p-6 md:p-12'>
				<h1 className='inline-flex flex-wrap items-center gap-y-1 text-3xl font-bold'>
					<span className='mr-2 inline-block'>Create a new project for</span>
					<span className='inline-flex items-center gap-2 rounded-lg px-2 text-foreground'>
						<Avatar className='size-6 rounded-full border border-primary'>
							<AvatarFallback className='rounded-lg'>{orgName[0].toUpperCase()}</AvatarFallback>
						</Avatar>
						<span className='text-gradient-primary'>{orgName}</span>
					</span>
				</h1>
				<div className='mt-10'>
					<form.AppForm>
						{!enabled && (
							<InlineAlert variant='warning' className='mb-6'>
								Maximum projects created. Please{' '}
								<a className='link-text' href='#'>
									change your plan
								</a>{' '}
								or contact support if you believe this is an error.
							</InlineAlert>
						)}
						<form.Form
							form={form}
							className={cn('flex flex-col gap-6', {
								'pointer-events-none opacity-50': !enabled,
							})}
						>
							<form.AppField name='name'>
								{(field) => (
									<field.Provider>
										<field.Label>Project name</field.Label>
										<field.Description>Name of your project.</field.Description>
										<field.Control>
											<Input
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												disabled={!enabled}
												autoFocus
											/>
										</field.Control>
										<field.Message />
									</field.Provider>
								)}
							</form.AppField>

							<form.AppField name='slug'>
								{(field) => (
									<field.Provider>
										<field.Label>Project Slug</field.Label>
										<field.Description>
											Will be be used in URL of your project. Must be unique to your organization.
										</field.Description>
										<field.Control>
											<div className='flex items-stretch'>
												<div className='flex items-center rounded-l-lg border-y border-l border-border bg-muted px-3 text-sm'>
													<span className='text-muted-foreground'>usekino.com/@{orgSlug}/</span>
												</div>
												<Input
													className='rounded-l-none'
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													disabled={!enabled}
												/>
											</div>
										</field.Control>
										<field.Message />
									</field.Provider>
								)}
							</form.AppField>

							<form.AppField name='visibility'>
								{(field) => (
									<field.Provider>
										<field.Label>Visibility</field.Label>
										<field.Description>Make your project public or private.</field.Description>
										<field.Control>
											<Select
												defaultValue={defaultValues.visibility}
												onValueChange={(value) =>
													field.handleChange(value as FormSchema['visibility'])
												}
												disabled={!enabled}
											>
												<SelectTrigger className='w-48'>
													<SelectValue placeholder='Sort by...' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='public'>Public</SelectItem>
													<SelectItem value='private'>Private</SelectItem>
												</SelectContent>
											</Select>
										</field.Control>
										<field.Message />
									</field.Provider>
								)}
							</form.AppField>

							<formError.Message prefix='Unable to create project' />

							<div className='flex items-center gap-2'>
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button
											type='submit'
											className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
											disabled={!enabled}
										>
											{isSubmitting ? 'Creating...' : 'Create Team'}
										</Button>
									)}
								</form.Subscribe>
							</div>
						</form.Form>
					</form.AppForm>
				</div>
			</div>
		</div>
	);
};
