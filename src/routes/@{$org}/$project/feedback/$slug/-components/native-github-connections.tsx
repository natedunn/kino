import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, GitBranch, Plus } from 'lucide-react';

import { SidebarSection } from '@/components/sidebar-section';
import { Button } from '@/components/ui/button';
import { useRelayAPI } from '@/lib/convex/relay-api';
import * as m from '@/paraglide/messages.js';

import {
	GitHubConnectionDialog,
	GithubConnectionIcon,
	GithubIssueStateBadge,
} from './github-connection-dialog';

export function NativeGithubConnections({
	feedbackId,
	orgSlug,
	projectSlug,
	canManage,
}: {
	feedbackId: string;
	orgSlug: string;
	projectSlug: string;
	canManage: boolean;
}) {
	const api = useRelayAPI(),
		[open, setOpen] = useState(true),
		[dialog, setDialog] = useState(false);
	const { data: connections = [] } = useQuery(
		api.feedbackGithub.listByFeedback.queryOptions({ feedbackId })
	);
	if (!canManage && !connections.length) return null;
	return (
		<>
			<SidebarSection
				icon={<GitBranch className='size-3.5' />}
				open={open}
				onOpenChange={setOpen}
				title={m.feedback_connections()}
			>
				<div className='flex flex-col'>
					{connections.length ? (
						connections.map((c) => (
							<a
								className='group flex min-w-0 items-center gap-2.5 rounded-md py-2 transition-colors hover:bg-muted/50'
								href={c.url}
								key={c.id}
								rel='noreferrer'
								target='_blank'
							>
								<GithubConnectionIcon />
								<span className='min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)] text-sm whitespace-nowrap [-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)]'>
									#{c.githubNumber} {c.title}
								</span>
								<GithubIssueStateBadge state={c.state} />
								<ExternalLink className='size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100' />
							</a>
						))
					) : (
						<p className='py-2 text-sm text-muted-foreground'>{m.feedback_no_github_items()}</p>
					)}
					{canManage ? (
						<Button
							className='mt-1 h-8 w-full justify-start gap-1.5 px-0 text-xs text-muted-foreground'
							onClick={() => setDialog(true)}
							size='sm'
							type='button'
							variant='ghost'
						>
							<Plus className='size-3' />
							{m.feedback_add_connection()}
						</Button>
					) : null}
				</div>
			</SidebarSection>
			<GitHubConnectionDialog
				feedbackId={feedbackId}
				orgSlug={orgSlug}
				projectSlug={projectSlug}
				open={dialog}
				onOpenChange={setDialog}
			/>
		</>
	);
}
