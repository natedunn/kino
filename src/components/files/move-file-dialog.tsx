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
			toast.success(`Moved to ${folderPickerPathLabel(folders, destinationFolderId)}`);
		} catch (error) {
			toast.error(extractErrorMessage(error, 'Unable to move file'));
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
					subtitle='Choose a new location in this project'
					title='Move file'
				/>
				<ResponsiveDialogBody>
					<div className='space-y-2'>
						<p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
							Choose destination
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
						Cancel
					</Button>
					<Button
						disabled={destinationFolderId === currentFolderId || moveMutation.isPending}
						onClick={move}
						size='sm'
					>
						<FolderInput />
						{moveMutation.isPending ? 'Moving…' : 'Move here'}
					</Button>
				</ResponsiveDialogFooter>
			</ResponsiveDialogContent>
		</ResponsiveDialog>
	);
}
