'use client';

import type { FolderPickerFolder } from '@/components/files/folder-picker-utils';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FolderInput } from 'lucide-react';
import { toast } from 'sonner';

import { FolderPicker } from '@/components/files/folder-picker';
import { folderPickerPathLabel } from '@/components/files/folder-picker-utils';
import { Button } from '@/components/ui/button';
import {
	ResponsiveDialog,
	ResponsiveDialogBody,
	ResponsiveDialogContent,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
} from '@/components/ui/responsive-dialog';
import { useCRPC } from '@/lib/convex/crpc';
import { extractErrorMessage } from '@/lib/errors';
import * as m from '@/paraglide/messages.js';

type MoveFileDialogProps = {
	file: {
		folderId?: string | null;
		id: string;
		name: string;
	};
	folders: Array<FolderPickerFolder>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

export function MoveFileDialog({ file, folders, onOpenChange, open }: MoveFileDialogProps) {
	const crpc = useCRPC();
	const moveMutation = useMutation(crpc.file.moveAsset.mutationOptions());
	const currentFolderId = file.folderId ?? null;
	const [destinationFolderId, setDestinationFolderId] = useState<string | null>(currentFolderId);

	useEffect(() => {
		if (open) setDestinationFolderId(currentFolderId);
	}, [currentFolderId, open]);

	const move = async () => {
		if (destinationFolderId === currentFolderId) return;
		try {
			await moveMutation.mutateAsync({ assetId: file.id, folderId: destinationFolderId });
			onOpenChange(false);
			toast.success(
				m.files_moved_to({
					location: folderPickerPathLabel(folders, destinationFolderId, m.files_root()),
				})
			);
		} catch (error) {
			toast.error(extractErrorMessage(error, m.files_move_failed()));
		}
	};

	return (
		<ResponsiveDialog onOpenChange={onOpenChange} open={open}>
			<ResponsiveDialogContent
				className='flex flex-col gap-0 overflow-hidden p-0'
				dialogClassName='max-h-[88vh] sm:max-w-lg'
				showCloseButton={false}
			>
				<ResponsiveDialogHeader
					icon={<FolderInput />}
					subtitle={m.files_move_description()}
					title={m.files_move_title()}
				/>
				<ResponsiveDialogBody>
					<div className='space-y-2'>
						<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
							{m.files_choose_destination()}
						</p>
						<FolderPicker
							disabled={moveMutation.isPending}
							folders={folders}
							onValueChange={setDestinationFolderId}
							value={destinationFolderId}
						/>
					</div>
				</ResponsiveDialogBody>
				<ResponsiveDialogFooter>
					<Button
						disabled={moveMutation.isPending}
						onClick={() => onOpenChange(false)}
						size='sm'
						variant='outline'
					>
						{m.common_cancel()}
					</Button>
					<Button
						disabled={destinationFolderId === currentFolderId || moveMutation.isPending}
						onClick={move}
						size='sm'
					>
						<FolderInput />
						{moveMutation.isPending ? m.files_moving() : m.files_move_here()}
					</Button>
				</ResponsiveDialogFooter>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}
