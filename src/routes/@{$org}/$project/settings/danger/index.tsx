import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { InlineAlert } from '@/components/inline-alert';
import { EmptyState } from '@/components/kino/common';
import { Label, LabelWrapper } from '@/components/label';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCRPC } from '@/lib/convex/crpc';
import { crpcServer } from '@/lib/convex/crpc-server';
import { titleMeta } from '@/lib/seo';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/@{$org}/$project/settings/danger/')({
	head: () => ({
		meta: [titleMeta(['Danger Zone'])],
	}),
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			crpcServer.project.getDetails.queryOptions({
				orgSlug: params.org,
				slug: params.project,
			})
		);
	},
	component: ProjectDangerSettingsRoute,
});

function ProjectDangerSettingsRoute() {
	const params = Route.useParams();
	const navigate = useNavigate();
	const crpc = useCRPC();
	const queryClient = useQueryClient();

	const detailsQuery = useQuery(
		crpc.project.getDetails.queryOptions({
			orgSlug: params.org,
			slug: params.project,
		})
	);

	const removeMutation = useMutation(crpc.project.remove.mutationOptions());

	const project = detailsQuery.data?.project;
	const canDelete = detailsQuery.data?.permissions.canDelete ?? false;

	const invalidateDetails = () =>
		queryClient.invalidateQueries({
			queryKey: crpc.project.getDetails.queryKey({
				orgSlug: params.org,
				slug: params.project,
			}),
		});

	if (detailsQuery.isLoading) {
		return (
			<div className='max-w-3xl space-y-4'>
				<div className='h-16 animate-pulse rounded-lg bg-muted/40' />
				<div className='h-52 animate-pulse rounded-xl bg-muted/40' />
			</div>
		);
	}

	if (!project || !canDelete) {
		return (
			<EmptyState
				title={m.project_danger_unavailable()}
				description={m.project_danger_unavailable_description()}
			/>
		);
	}

	return (
		<section className='max-w-3xl'>
			<header className='border-b pb-4'>
				<h2 className='text-xl font-semibold'>{m.security_danger_zone()}</h2>
				<p className='mt-1 text-sm text-muted-foreground'>{m.project_danger_description()}</p>
			</header>

			<DangerZone
				onDelete={async () => {
					await removeMutation.mutateAsync({ id: project.id });
					await invalidateDetails();
					await navigate({ params: { org: params.org }, to: '/@{$org}' });
				}}
				projectName={project.name}
				projectSlug={project.slug}
			/>
		</section>
	);
}

function DangerZone({
	onDelete,
	projectName,
	projectSlug,
}: {
	onDelete: () => Promise<void>;
	projectName: string;
	projectSlug: string;
}) {
	const [open, setOpen] = useState(false);
	const [confirmText, setConfirmText] = useState('');
	const [deleting, setDeleting] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

	const canConfirm = confirmText.trim() === projectSlug && !deleting;

	return (
		<div className='mt-6'>
			<div className='rounded-xl border border-destructive/40 p-6'>
				<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<div>
						<p className='text-sm font-medium'>{m.project_delete()}</p>
						<p className='text-xs text-muted-foreground'>
							{m.project_delete_summary({ name: projectName })}
						</p>
					</div>
					<Button
						className='sm:self-auto'
						onClick={() => {
							setConfirmText('');
							setDialogError(null);
							setOpen(true);
						}}
						type='button'
						variant='destructive'
					>
						{m.common_delete()}
					</Button>
				</div>
			</div>

			<Dialog onOpenChange={setOpen} open={open}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{m.project_delete_confirm_title()}</DialogTitle>
						<DialogDescription>
							{m.project_delete_confirm_description({ name: projectName })}
						</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-2'>
						<LabelWrapper>
							<Label>
								{m.project_delete_type_prefix()} <span className='font-mono'>{projectSlug}</span>{' '}
								{m.project_delete_type_suffix()}
							</Label>
						</LabelWrapper>
						<Input
							autoComplete='off'
							onChange={(event) => setConfirmText(event.target.value)}
							spellCheck={false}
							value={confirmText}
						/>
						{dialogError ? (
							<InlineAlert size='sm' variant='danger'>
								{dialogError}
							</InlineAlert>
						) : null}
					</div>
					<DialogFooter>
						<DialogClose render={<Button type='button' variant='outline' />}>
							{m.common_cancel()}
						</DialogClose>
						<Button
							disabled={!canConfirm}
							onClick={async () => {
								setDeleting(true);
								setDialogError(null);
								try {
									await onDelete();
								} catch (err) {
									setDialogError(err instanceof Error ? err.message : m.project_delete_failed());
									setDeleting(false);
								}
							}}
							type='button'
							variant='destructive'
						>
							{deleting ? m.common_deleting() : m.project_delete()}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
