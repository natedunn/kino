import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { useForm } from '@tanstack/react-form';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import z from 'zod';

import { api } from '~api';
import { InlineAlert } from '@/components/inline-alert';
import { Label, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTeamSchema } from '@/convex/api/team.utils';
import { authClient } from '@/lib/auth/auth-client';
import { cn } from '@/lib/utils';

const formSchema = createTeamSchema;

type FormSchema = z.infer<typeof formSchema>;

export const Route = createFileRoute('/_default/create/team')({
	component: RouteComponent,
	loader: async ({ context }) => {
		if (!context.user) {
			redirect({
				to: '/sign-in',
			});
		}

		const { teams } = await context.queryClient.ensureQueryData(
			convexQuery(api.user.getTeamList, {})
		);

		return {
			canAddTeams: teams.length < 2,
		};
	},
});

function RouteComponent() {
	const { canAddTeams } = Route.useLoaderData();

	const {
		data: { teams },
	} = useSuspenseQuery(convexQuery(api.user.getTeamList, {}));

	const { mutate: createTeam } = useMutation({
		mutationFn: useConvexMutation(api.team.create),
		onSuccess: () => {
			console.log('Success');
		},
	});

	const defaultValues: FormSchema = {
		name: '',
		slug: '',
		logo: '',
	};

	const form = useForm({
		defaultValues,
		validators: {
			onChange: formSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			createTeam({
				name: value.name,
				slug: value.slug,
				...(!!value.logo
					? {
							logo: value.logo,
						}
					: {}),
			});
			formApi.reset();
		},
	});

	const handleDelete = async (id: string) => {
		await authClient.organization.delete({
			organizationId: id,
		});
	};

	return (
		<div className='relative w-full'>
			<div className='absolute top-0 right-0 left-0 z-0 h-64 w-full bg-gradient-to-t from-background to-muted'></div>

			<div className='relative z-10 mx-auto max-w-2xl px-10 py-12'>
				<h1 className='text-3xl font-bold'>Create a team</h1>
				{!canAddTeams && (
					<InlineAlert variant='warning' className='mt-6'>
						Maximum teams created. Please{' '}
						<a className='link-text' href='#'>
							change your plan
						</a>{' '}
						or contact support.
					</InlineAlert>
				)}
				<form
					className='mt-6 flex flex-col gap-6'
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name='name'>
						{(field) => {
							return (
								<div className='flex items-end gap-3'>
									<div className='flex flex-1 flex-col gap-2'>
										<LabelWrapper>
											<Label>Project name</Label>
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

					<form.Field name='slug'>
						{(field) => {
							return (
								<div className='flex items-end gap-3'>
									<div className='flex flex-1 flex-col gap-2'>
										<LabelWrapper>
											<Label>Slug</Label>
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

					<div className='flex items-center gap-2'>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button
									type='submit'
									className={cn({ 'opacity-50 grayscale select-none': !canSubmit })}
								>
									{isSubmitting ? 'Creating...' : 'Create Team'}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>

				{/* <details className='mt-10'>
					<summary>Teams</summary> */}
				<div className='mt-6 flex flex-col gap-2'>
					{teams?.map((org) => (
						<div key={org.id}>
							<Button onClick={async () => await handleDelete(org.id)}>Delete: {org.name}</Button>
						</div>
					))}
				</div>
				{/* </details> */}
			</div>
		</div>
	);
}
