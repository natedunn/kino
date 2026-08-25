import type { AppCommand, CommandGroupName } from './types';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, File, FileArchive, FileImage, FileText, FileVideo } from 'lucide-react';

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from '@/components/ui/command';
import { useCRPC } from '@/lib/convex/crpc';

const GROUP_ORDER: Array<CommandGroupName> = ['Files', 'Feedback', 'Global', 'Navigation'];

type RankedCommandGroup = {
	commands: Array<AppCommand>;
	group: CommandGroupName;
};

function normalizeSearchText(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim();
}

function fuzzySubsequenceScore(value: string, query: string) {
	let queryIndex = 0;
	let firstMatch = -1;
	let lastMatch = -1;

	for (let valueIndex = 0; valueIndex < value.length && queryIndex < query.length; valueIndex++) {
		if (value[valueIndex] !== query[queryIndex]) continue;
		if (firstMatch === -1) firstMatch = valueIndex;
		lastMatch = valueIndex;
		queryIndex++;
	}

	if (queryIndex !== query.length) return 0;
	const spread = lastMatch - firstMatch + 1;
	return Math.max(1, 120 - spread - firstMatch * 0.25);
}

function scoreText(value: string, query: string) {
	if (value === query) return 1000;
	if (value.startsWith(query)) return 900;
	if (value.split(' ').some((word) => word.startsWith(query))) return 850;
	if (value.includes(query)) return 750;
	return fuzzySubsequenceScore(value, query);
}

function scoreCommand(command: AppCommand, rawQuery: string) {
	const query = normalizeSearchText(rawQuery);
	if (!query) return 0;

	const title = normalizeSearchText(command.title);
	const keywords = (command.keywords ?? []).map(normalizeSearchText);
	const tokens = query.split(/\s+/);
	let total = 0;

	for (const token of tokens) {
		const titleScore = scoreText(title, token);
		const keywordScore = Math.max(0, ...keywords.map((keyword) => scoreText(keyword, token) - 200));
		const tokenScore = Math.max(titleScore, keywordScore);
		if (tokenScore <= 0) return 0;
		total += tokenScore;
	}

	// Context should settle genuinely close results, never outrank a stronger text match.
	return total + (command.contextual ? 0.01 : 0);
}

type CommandPaletteMode = 'commands' | 'files';

type CommandPaletteProps = {
	commands: Array<AppCommand>;
	fileSearchContext?: { orgSlug: string; projectSlug: string };
	initialQuery: string;
	mode: CommandPaletteMode;
	onModeChange: (mode: CommandPaletteMode) => void;
	onOpenChange: (open: boolean) => void;
	onOpenFile: (fileId: string) => void;
	onRunCommand: (command: AppCommand) => void;
	open: boolean;
};

export function CommandPalette({
	commands,
	fileSearchContext,
	initialQuery,
	mode,
	onModeChange,
	onOpenChange,
	onOpenFile,
	onRunCommand,
	open,
}: CommandPaletteProps) {
	const crpc = useCRPC();
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState(initialQuery);
	const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
	const [selectedCommandId, setSelectedCommandId] = useState('');
	const projectQuery = useQuery({
		...crpc.project.getDetails.queryOptions({
			orgSlug: fileSearchContext?.orgSlug ?? '',
			slug: fileSearchContext?.projectSlug ?? '',
		}),
		enabled: mode === 'files' && !!fileSearchContext,
	});
	const projectId = projectQuery.data?.project?.id;
	const filesQuery = useQuery({
		...crpc.file.listProjectFiles.queryOptions({
			cursor: null,
			limit: 10,
			projectId: projectId ?? '',
			search: debouncedQuery.trim() || undefined,
			sort: debouncedQuery.trim() ? undefined : 'edited_desc',
		}),
		enabled: mode === 'files' && !!projectId,
	});

	useEffect(() => {
		setQuery(initialQuery);
		setDebouncedQuery(initialQuery);
	}, [initialQuery, mode]);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedQuery(query), 200);
		return () => window.clearTimeout(timer);
	}, [query]);

	const rankedCommandGroups = useMemo<Array<RankedCommandGroup>>(() => {
		const grouped = new Map<CommandGroupName, Array<AppCommand>>();
		const trimmedQuery = query.trim();

		for (const command of commands) {
			if (command.disabled) continue;
			if (trimmedQuery && scoreCommand(command, trimmedQuery) <= 0) continue;

			const existing = grouped.get(command.group);
			if (existing) {
				existing.push(command);
			} else {
				grouped.set(command.group, [command]);
			}
		}

		if (trimmedQuery) {
			return [...grouped.entries()]
				.map(([group, groupCommands]) => ({
					commands: [...groupCommands].sort(
						(a, b) => scoreCommand(b, trimmedQuery) - scoreCommand(a, trimmedQuery)
					),
					group,
				}))
				.sort((a, b) => {
					const scoreDifference =
						scoreCommand(b.commands[0], trimmedQuery) -
						scoreCommand(a.commands[0], trimmedQuery);
					if (scoreDifference !== 0) return scoreDifference;
					return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
				});
		}

		const contextualGroups = GROUP_ORDER.filter((group) =>
			grouped.get(group)?.some((command) => command.contextual)
		);
		const remainingGroups = GROUP_ORDER.filter((group) => !contextualGroups.includes(group));

		return [...contextualGroups, ...remainingGroups].flatMap((group) => {
			const groupCommands = grouped.get(group);
			return groupCommands ? [{ commands: groupCommands, group }] : [];
		});
	}, [commands, query]);

	useEffect(() => {
		if (mode !== 'commands') return;
		setSelectedCommandId(rankedCommandGroups[0]?.commands[0]?.id ?? '');
	}, [mode, query, rankedCommandGroups]);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			setQuery('');
			setDebouncedQuery('');
		}

		onOpenChange(nextOpen);
	}

	function returnToCommands() {
		setQuery('');
		setDebouncedQuery('');
		onModeChange('commands');
	}

	return (
		<CommandDialog
			commandValue={mode === 'commands' ? selectedCommandId : undefined}
			description={mode === 'files' ? 'Search all files in this project' : undefined}
			initialFocus={inputRef}
			onCommandValueChange={mode === 'commands' ? setSelectedCommandId : undefined}
			onOpenChange={handleOpenChange}
			open={open}
			shouldFilter={false}
			title={mode === 'files' ? 'Search files' : undefined}
		>
			<CommandInput
				ref={inputRef}
				onKeyDown={(event) => {
					if (event.key !== 'Escape' || mode !== 'files') return;
					event.preventDefault();
					event.stopPropagation();
					returnToCommands();
				}}
				onValueChange={setQuery}
				placeholder={
					mode === 'files' ? 'Search all files in this project...' : 'Type a command or search...'
				}
				value={query}
			/>
			{mode === 'files' ? (
				<FileSearchResults
					files={filesQuery.data?.page ?? []}
					loading={projectQuery.isPending || filesQuery.isPending || query !== debouncedQuery}
					onBack={returnToCommands}
					onOpenFile={onOpenFile}
					query={debouncedQuery}
				/>
			) : (
				<CommandList className='px-1.5 sm:scroll-pb-12 sm:px-2 sm:pb-12'>
					{rankedCommandGroups.length === 0 ? <CommandEmpty>No results found.</CommandEmpty> : null}
					{rankedCommandGroups.map(({ commands: groupCommands, group }) => {
						return (
							<CommandGroup key={group} heading={group}>
								{groupCommands.map((command) => {
									const Icon = command.icon;

									return (
										<CommandItem
											key={command.id}
											onSelect={() => onRunCommand(command)}
											value={command.id}
										>
											{Icon ? <Icon /> : null}
											<span className='font-medium'>{command.title}</span>
											{command.shortcut ? (
												<CommandShortcut>{command.shortcut}</CommandShortcut>
											) : null}
										</CommandItem>
									);
								})}
							</CommandGroup>
						);
					})}
				</CommandList>
			)}
			<CommandPaletteFooter mode={mode} />
		</CommandDialog>
	);
}

function FileSearchResults({
	files,
	loading,
	onBack,
	onOpenFile,
	query,
}: {
	files: Array<any>;
	loading: boolean;
	onBack: () => void;
	onOpenFile: (fileId: string) => void;
	query: string;
}) {
	return (
		<CommandList className='px-1.5 sm:scroll-pb-12 sm:px-2 sm:pb-12'>
			<CommandGroup>
				<CommandItem forceMount onSelect={onBack} value='Back to commands'>
					<ArrowLeft />
					<span>Back to commands</span>
					<CommandShortcut>Esc</CommandShortcut>
				</CommandItem>
			</CommandGroup>
			{loading ? (
				<p className='px-4 py-12 text-center text-base text-muted-foreground'>Searching files...</p>
			) : files.length === 0 ? (
				<p className='px-4 py-12 text-center text-base text-muted-foreground'>
					{query.trim() ? 'No matching files.' : 'No files in this project.'}
				</p>
			) : (
				<CommandGroup heading={query.trim() ? 'Files' : 'Recently edited files'}>
					{files.map((file) => {
						const Icon = fileIcon(file.category);
						return (
							<CommandItem key={file.id} onSelect={() => onOpenFile(file.id)} value={file.id}>
								<Icon />
								<span className='min-w-0 flex-1 truncate font-medium'>{file.name}</span>
							</CommandItem>
						);
					})}
				</CommandGroup>
			)}
		</CommandList>
	);
}

function CommandPaletteFooter({ mode }: { mode: CommandPaletteMode }) {
	return (
		<div className='absolute inset-x-0 bottom-0 z-10 hidden items-center gap-4 border-t border-white/10 bg-gradient-to-b from-background/65 to-background/90 px-4 py-2.5 text-xs text-muted-foreground shadow-[0_-10px_22px_-18px_rgba(0,0,0,0.2)] backdrop-blur-lg sm:flex dark:shadow-[0_-12px_28px_-18px_rgba(0,0,0,0.65)]'>
			<span className='font-medium text-foreground/75'>
				{mode === 'files' ? 'Project files' : 'Command palette'}
			</span>
			<span className='ml-auto flex items-center gap-1.5'>
				<kbd className='rounded border bg-background/80 px-1.5 py-0.5 font-sans'>↑↓</kbd>
				Navigate
			</span>
			<span className='flex items-center gap-1.5'>
				<kbd className='rounded border bg-background/80 px-1.5 py-0.5 font-sans'>↵</kbd>
				Open
			</span>
			<span className='flex items-center gap-1.5'>
				<kbd className='rounded border bg-background/80 px-1.5 py-0.5 font-sans'>esc</kbd>
				{mode === 'files' ? 'Commands' : 'Close'}
			</span>
		</div>
	);
}

function fileIcon(category: string) {
	if (category === 'image') return FileImage;
	if (category === 'video') return FileVideo;
	if (category === 'package') return FileArchive;
	if (category === 'document' || category === 'text' || category === 'data') return FileText;
	return File;
}
