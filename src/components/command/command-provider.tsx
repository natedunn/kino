import type { ReactNode } from 'react';
import type { AppCommand, CommandRegistration } from './types';

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { Home, MoonStar, Settings, User } from 'lucide-react';

import { ArchivePencilOutline18 } from '@/icons/nucleo/ArchivePencilOutline18';
import { CalendarDaysOutline18 } from '@/icons/nucleo/CalendarDaysOutline18';
import { Folder5OpenOutline18 } from '@/icons/nucleo/Folder5OpenOutline18';
import { House4Outline18 } from '@/icons/nucleo/House4Outline18';
import { InterviewOutline18 } from '@/icons/nucleo/InterviewOutline18';
import { Roadmap2Outline18 } from '@/icons/nucleo/Roadmap2Outline18';
import { authClient } from '@/lib/auth/auth-client';
import { toggleThemePreference } from '@/lib/theme';

import { CommandContext } from './command-context';

const CommandPalette = lazy(() =>
	import('./command-palette').then((m) => ({ default: m.CommandPalette }))
);

export function CommandProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<'commands' | 'files'>('commands');
	const [initialQuery, setInitialQuery] = useState('');
	const [registrations, setRegistrations] = useState<Array<CommandRegistration>>([]);
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	// The command palette (and its ⌘K shortcut) is disabled on the auth pages.
	const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/');
	const session = authClient.useSession();
	const orgParams = useParams({
		from: '/@{$org}',
		shouldThrow: false,
	});
	const projectParams = useParams({
		from: '/@{$org}/$project',
		shouldThrow: false,
	});

	const orgSlug = orgParams?.org;
	const projectSlug = projectParams?.project;
	const isAuthenticated = !!session.data?.user;

	const registerCommands = useCallback((scopeId: string, commands: Array<AppCommand>) => {
		setRegistrations((current) => [
			...current.filter((registration) => registration.scopeId !== scopeId),
			{ scopeId, commands },
		]);

		return () => {
			setRegistrations((current) =>
				current.filter((registration) => registration.scopeId !== scopeId)
			);
		};
	}, []);

	const globalCommands = useMemo<Array<AppCommand>>(() => {
		const commands: Array<AppCommand> = [
			{
				group: 'Global',
				icon: MoonStar,
				id: 'theme.toggle',
				keywords: ['appearance', 'dark', 'light'],
				title: 'Toggle light/dark mode',
				run: toggleThemePreference,
			},
		];

		if (isAuthenticated) {
			commands.push(
				{
					group: 'Global',
					icon: Home,
					id: 'global.dashboard',
					keywords: ['home', 'teams'],
					title: 'Go to dashboard',
					run: () => navigate({ to: '/dashboard' }),
				},
				{
					group: 'Global',
					icon: User,
					id: 'global.profile-settings',
					keywords: ['account', 'settings', 'profile'],
					title: 'Go to account settings',
					run: () => navigate({ to: '/account/profile' }),
				}
			);
		}

		if (orgSlug) {
			commands.push(
				{
					group: 'Navigation',
					icon: Home,
					id: 'org.home',
					keywords: ['organization', 'team'],
					title: 'Go to organization home',
					run: () => navigate({ params: { org: orgSlug }, to: '/@{$org}' }),
				},
				{
					group: 'Navigation',
					icon: Settings,
					id: 'org.settings',
					keywords: ['organization', 'team', 'settings'],
					title: 'Go to organization settings',
					run: () => navigate({ search: { org: orgSlug }, to: '/org/settings' }),
				}
			);
		}

		if (orgSlug && projectSlug) {
			const params = { org: orgSlug, project: projectSlug };

			commands.push(
				{
					group: 'Navigation',
					icon: House4Outline18,
					id: 'project.overview',
					keywords: ['project', 'overview'],
					title: 'Go to overview',
					run: () => navigate({ params, to: '/@{$org}/$project' }),
				},
				{
					group: 'Navigation',
					icon: ArchivePencilOutline18,
					id: 'project.feedback',
					keywords: ['project', 'feedback'],
					title: 'Go to feedback',
					run: () => navigate({ params, to: '/@{$org}/$project/feedback' }),
				},
				{
					group: 'Navigation',
					icon: CalendarDaysOutline18,
					id: 'project.updates',
					keywords: ['project', 'updates', 'changelog'],
					title: 'Go to updates',
					run: () => navigate({ params, to: '/@{$org}/$project/updates' }),
				},
				{
					group: 'Navigation',
					icon: Roadmap2Outline18,
					id: 'project.roadmap',
					keywords: ['project', 'roadmap'],
					title: 'Go to roadmap',
					run: () => navigate({ params, to: '/@{$org}/$project/roadmap' }),
				},
				{
					group: 'Navigation',
					icon: Folder5OpenOutline18,
					id: 'project.files',
					keywords: ['project', 'files', 'assets', 'documents'],
					title: 'Go to files',
					run: () => navigate({ params, to: '/@{$org}/$project/files' }),
				},
				{
					group: 'Navigation',
					icon: InterviewOutline18,
					id: 'project.discussions',
					keywords: ['project', 'discussions'],
					title: 'Go to discussions',
					run: () => navigate({ params, to: '/@{$org}/$project/discussions' }),
				}
			);
		}

		return commands;
	}, [isAuthenticated, navigate, orgSlug, projectSlug]);

	const commands = useMemo(
		() => [
			...globalCommands,
			...registrations.flatMap((registration) =>
				registration.commands.map((command) => ({
					...command,
					contextual: command.contextual ?? true,
				}))
			),
		],
		[globalCommands, registrations]
	);

	// Subscribing to a document event genuinely needs an effect; the auth-route
	// guard just skips binding the ⌘K listener there. (The palette's *visibility*
	// on auth routes is handled by deriving `isOpen` below — no state sync here.)
	useEffect(() => {
		if (isAuthRoute) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				setOpen((current) => {
					if (!current) {
						setInitialQuery('');
						setMode('commands');
					}
					return !current;
				});
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isAuthRoute]);

	// Force the palette closed on auth routes without writing state in an effect.
	const isOpen = open && !isAuthRoute;

	const runCommand = useCallback((command: AppCommand) => {
		if (command.closeOnRun !== false) setOpen(false);
		Promise.resolve(command.run()).catch((error) => {
			console.error(`Command "${command.id}" failed:`, error);
		});
	}, []);

	const contextValue = useMemo(
		() => ({
			close: () => setOpen(false),
			open: () => {
				setInitialQuery('');
				setMode('commands');
				setOpen(true);
			},
			openFileSearch: (query = '') => {
				setInitialQuery(query);
				setMode('files');
				setOpen(true);
			},
			registerCommands,
		}),
		[registerCommands]
	);

	return (
		<CommandContext.Provider value={contextValue}>
			{children}
			<Suspense fallback={null}>
				<CommandPalette
					commands={commands}
					fileSearchContext={orgSlug && projectSlug ? { orgSlug, projectSlug } : undefined}
					initialQuery={initialQuery}
					mode={mode}
					onModeChange={setMode}
					onOpenChange={(nextOpen) => {
						setOpen(nextOpen);
						if (!nextOpen) {
							setInitialQuery('');
							setMode('commands');
						}
					}}
					onOpenFile={(fileId) => {
						if (!orgSlug || !projectSlug) return;
						setOpen(false);
						setInitialQuery('');
						setMode('commands');
						void navigate({
							params: { fileId, org: orgSlug, project: projectSlug },
							to: '/@{$org}/$project/files/file/$fileId',
						});
					}}
					onRunCommand={runCommand}
					open={isOpen}
				/>
			</Suspense>
		</CommandContext.Provider>
	);
}
