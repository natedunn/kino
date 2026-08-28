'use client';

import type { FolderPickerFolder } from '@/components/files/folder-picker-utils';
import type { ReactNode } from 'react';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Folder, FolderOpen } from 'lucide-react';

import { buildFolderPath, folderPickerPathLabel } from '@/components/files/folder-picker-utils';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

type FolderPickerProps = {
	className?: string;
	disabled?: boolean;
	folders: Array<FolderPickerFolder>;
	onValueChange: (folderId: string | null) => void;
	value: string | null;
};

export function FolderPicker({
	className,
	disabled = false,
	folders,
	onValueChange,
	value,
}: FolderPickerProps) {
	const foldersById = useMemo(
		() => new Map(folders.map((folder) => [folder.id, folder])),
		[folders]
	);
	const childrenByParent = useMemo(() => {
		const children = new Map<string | null, Array<FolderPickerFolder>>();
		for (const folder of folders) {
			const parentId = folder.parentFolderId ?? null;
			const siblings = children.get(parentId) ?? [];
			siblings.push(folder);
			children.set(parentId, siblings);
		}
		for (const siblings of children.values()) {
			siblings.sort((a, b) => a.name.localeCompare(b.name));
		}
		return children;
	}, [folders]);
	const selectedPath = useMemo(
		() => buildFolderPath(foldersById, value).map((folder) => folder.id),
		[foldersById, value]
	);
	const [rootExpanded, setRootExpanded] = useState(true);
	const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
		() => new Set(selectedPath)
	);

	useEffect(() => {
		setRootExpanded(true);
		setExpandedFolderIds((current) => new Set([...current, ...selectedPath]));
	}, [selectedPath]);

	const toggleFolder = (folderId: string) => {
		setExpandedFolderIds((current) => {
			const next = new Set(current);
			if (next.has(folderId)) next.delete(folderId);
			else next.add(folderId);
			return next;
		});
	};

	const renderFolder = (folder: FolderPickerFolder, depth: number): ReactNode => {
		const children = childrenByParent.get(folder.id) ?? [];
		const expanded = expandedFolderIds.has(folder.id);
		const selected = value === folder.id;
		return (
			<div key={folder.id} role='none'>
				<FolderTreeRow
					depth={depth}
					disabled={disabled}
					expanded={expanded}
					hasChildren={children.length > 0}
					label={folder.name}
					onSelect={() => onValueChange(folder.id)}
					onToggle={() => toggleFolder(folder.id)}
					selected={selected}
				/>
				{expanded && children.length ? (
					<div role='group'>{children.map((child) => renderFolder(child, depth + 1))}</div>
				) : null}
			</div>
		);
	};

	const rootFolders = childrenByParent.get(null) ?? [];

	return (
		<div
			className={cn(
				'overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs',
				className
			)}
		>
			<div
				aria-label={m.files_project_folders()}
				className='max-h-64 min-h-44 overflow-y-auto p-1.5'
				role='tree'
			>
				<FolderTreeRow
					depth={0}
					disabled={disabled}
					expanded={rootExpanded}
					hasChildren={rootFolders.length > 0}
					label='Root'
					onSelect={() => onValueChange(null)}
					onToggle={() => setRootExpanded((expanded) => !expanded)}
					selected={value === null}
				/>
				{rootExpanded && rootFolders.length ? (
					<div role='group'>{rootFolders.map((folder) => renderFolder(folder, 1))}</div>
				) : null}
			</div>
			<div className='border-t bg-muted/20 px-3 py-2.5'>
				<p className='text-[10px] font-semibold tracking-wider text-muted-foreground uppercase'>
					Selected location
				</p>
				<div className='mt-1 flex items-start gap-2 text-sm font-medium'>
					<FolderOpen className='mt-0.5 size-3.5 shrink-0 text-primary' />
					<span className='break-words'>
						{folderPickerPathLabel(folders, value, m.files_root())}
					</span>
				</div>
			</div>
		</div>
	);
}

function FolderTreeRow({
	depth,
	disabled,
	expanded,
	hasChildren,
	label,
	onSelect,
	onToggle,
	selected,
}: {
	depth: number;
	disabled: boolean;
	expanded: boolean;
	hasChildren: boolean;
	label: string;
	onSelect: () => void;
	onToggle: () => void;
	selected: boolean;
}) {
	const Icon = expanded ? FolderOpen : Folder;
	return (
		<div
			aria-expanded={hasChildren ? expanded : undefined}
			aria-level={depth + 1}
			aria-selected={selected}
			className={cn(
				'group relative flex min-h-9 items-center rounded-lg border border-transparent transition-colors',
				disabled && 'opacity-50',
				selected ? 'border-primary/20 bg-primary/9 text-foreground' : 'hover:bg-muted/65'
			)}
			role='treeitem'
			style={{ paddingLeft: `${depth * 14 + 4}px` }}
		>
			{depth > 0 ? (
				<span aria-hidden='true' className='pointer-events-none absolute inset-y-0 left-0'>
					{Array.from({ length: depth }, (_, index) => (
						<span
							className='absolute inset-y-0 w-px bg-border/65'
							key={index}
							style={{ left: `${index * 14 + 7}px` }}
						/>
					))}
				</span>
			) : null}
			{hasChildren ? (
				<button
					aria-label={
						expanded
							? m.files_collapse_folder({ name: label })
							: m.files_expand_folder({ name: label })
					}
					className={cn(
						'relative z-10 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground disabled:cursor-not-allowed',
						selected
							? 'hover:bg-primary/15 hover:text-primary'
							: 'hover:bg-foreground/10 hover:text-foreground'
					)}
					disabled={disabled}
					onClick={onToggle}
					type='button'
				>
					<ChevronRight className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
				</button>
			) : (
				<span aria-hidden='true' className='size-7 shrink-0' />
			)}
			<button
				className='relative z-10 flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-md px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed'
				disabled={disabled}
				onClick={onSelect}
				title={label}
				type='button'
			>
				<Icon
					className={cn('size-3.5 shrink-0 text-muted-foreground', selected && 'text-primary')}
				/>
				<span className='min-w-0 flex-1 truncate text-sm'>{label}</span>
				{selected ? <Check className='size-3.5 shrink-0 text-primary' /> : null}
			</button>
		</div>
	);
}
