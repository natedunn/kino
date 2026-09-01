import type { ReactNode } from 'react';
import type { AppCommand, CommandRegistration } from './types';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import * as m from '@/paraglide/messages.js';

import { CommandContext } from './command-context';

const COMMAND_PALETTE_IDLE_TIMEOUT_MS = 2_000;
const COMMAND_PALETTE_FALLBACK_DELAY_MS = 1_500;

function importCommandPaletteModule() {
	return import('./command-palette');
}

let commandPaletteModulePromise: ReturnType<typeof importCommandPaletteModule> | undefined;

function loadCommandPaletteModule() {
	commandPaletteModulePromise ??= importCommandPaletteModule();
	return commandPaletteModulePromise;
}

type CommandPaletteModule = Awaited<ReturnType<typeof importCommandPaletteModule>>;
type LoadedCommandPalette = CommandPaletteModule['CommandPalette'];

type IdleCallbackApi = {
	cancelIdleCallback?: (handle: number) => void;
	requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

export function CommandProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [isPaletteMounted, setPaletteMounted] = useState(false);
	const [CommandPalette, setCommandPalette] = useState<LoadedCommandPalette | null>(null);
	const [mode, setMode] = useState<'commands' | 'files' | 'updates'>('commands');
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
	const preloadPalette = useCallback(() => {
		void loadCommandPaletteModule().then((module) => {
			setCommandPalette((current: LoadedCommandPalette | null) => current ?? module.CommandPalette);
		});
	}, []);
	const preparePalette = useCallback(() => {
		preloadPalette();
		setPaletteMounted(true);
	}, [preloadPalette]);

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
				title: m.command_toggle_theme(),
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
					title: m.command_go_dashboard(),
					run: () => navigate({ to: '/dashboard' }),
				},
				{
					group: 'Global',
					icon: User,
					id: 'global.profile-settings',
					keywords: ['account', 'settings', 'profile'],
					title: m.command_go_account(),
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
					title: m.command_go_org(),
					run: () => navigate({ params: { org: orgSlug }, to: '/@{$org}' }),
				},
				{
					group: 'Navigation',
					icon: Settings,
					id: 'org.settings',
					keywords: ['organization', 'team', 'settings'],
					title: m.command_go_org_settings(),
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
					title: m.command_go_overview(),
					run: () => navigate({ params, to: '/@{$org}/$project' }),
				},
				{
					group: 'Navigation',
					icon: ArchivePencilOutline18,
					id: 'project.feedback',
					keywords: ['project', 'feedback'],
					title: m.command_go_feedback(),
					run: () => navigate({ params, to: '/@{$org}/$project/feedback' }),
				},
				{
					group: 'Navigation',
					icon: CalendarDaysOutline18,
					id: 'project.updates',
					keywords: ['project', 'updates', 'changelog'],
					title: m.command_go_updates(),
					run: () => navigate({ params, to: '/@{$org}/$project/updates' }),
				},
				{
					group: 'Navigation',
					icon: Roadmap2Outline18,
					id: 'project.roadmap',
					keywords: ['project', 'roadmap'],
					title: m.command_go_roadmap(),
					run: () => navigate({ params, to: '/@{$org}/$project/roadmap' }),
				},
				{
					group: 'Navigation',
					icon: Folder5OpenOutline18,
					id: 'project.files',
					keywords: ['project', 'files', 'assets', 'documents'],
					title: m.command_go_files(),
					run: () => navigate({ params, to: '/@{$org}/$project/files' }),
				},
				{
					group: 'Navigation',
					icon: InterviewOutline18,
					id: 'project.discussions',
					keywords: ['project', 'discussions'],
					title: m.command_go_discussions(),
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
		const idleApi = window as unknown as IdleCallbackApi;
		if (idleApi.requestIdleCallback) {
			const handle = idleApi.requestIdleCallback(preloadPalette, {
				timeout: COMMAND_PALETTE_IDLE_TIMEOUT_MS,
			});
			return () => idleApi.cancelIdleCallback?.(handle);
		}

		const timeout = window.setTimeout(preloadPalette, COMMAND_PALETTE_FALLBACK_DELAY_MS);
		return () => window.clearTimeout(timeout);
	}, [isAuthRoute, preloadPalette]);

	useEffect(() => {
		if (isAuthRoute) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				preparePalette();
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
	}, [isAuthRoute, preparePalette]);

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
				preparePalette();
				setInitialQuery('');
				setMode('commands');
				setOpen(true);
			},
			openFileSearch: (query = '') => {
				preparePalette();
				setInitialQuery(query);
				setMode('files');
				setOpen(true);
			},
			openUpdateSearch: (query = '') => {
				preparePalette();
				setInitialQuery(query);
				setMode('updates');
				setOpen(true);
			},
			preload: preloadPalette,
			registerCommands,
		}),
		[preloadPalette, preparePalette, registerCommands]
	);

	return (
		<CommandContext.Provider value={contextValue}>
			{children}
			{isPaletteMounted && CommandPalette ? (
				<CommandPalette
					commands={commands}
					projectSearchContext={orgSlug && projectSlug ? { orgSlug, projectSlug } : undefined}
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
					onOpenUpdate={(slug) => {
						if (!orgSlug || !projectSlug) return;
						setOpen(false);
						setInitialQuery('');
						setMode('commands');
						void navigate({
							params: { org: orgSlug, project: projectSlug, slug },
							to: '/@{$org}/$project/updates/$slug',
						});
					}}
					onRunCommand={runCommand}
					open={isOpen}
				/>
			) : null}
		</CommandContext.Provider>
	);
}
