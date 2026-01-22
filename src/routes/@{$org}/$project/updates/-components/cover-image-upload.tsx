import { useRef, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMutation as convexMutation } from 'convex/react';
import { ImagePlus, Loader2, X } from 'lucide-react';

import { api } from '~api';
import { Button } from '@/components/ui/button';
import { Id } from '@/convex/_generated/dataModel';
import { cn } from '@/lib/utils';

type CoverImageUploadProps = {
	updateId: Id<'update'>;
	currentCoverImageId?: string;
	onUploadComplete?: () => void;
};

export function CoverImageUpload({
	updateId,
	currentCoverImageId,
	onUploadComplete,
}: CoverImageUploadProps) {
	const [isUploading, setIsUploading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const generateUploadUrl = convexMutation(api.update.generateCoverImageUploadUrl);
	const syncMetadata = convexMutation(api.update.syncMetadata);

	// Get the current cover image URL if one exists
	const { data: coverImageUrl } = useQuery({
		...convexQuery(api.update.getCoverImageUrl, {
			key: currentCoverImageId ?? '',
		}),
		enabled: !!currentCoverImageId,
	});

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be less than 5MB');
			return;
		}

		// Show preview
		setPreviewUrl(URL.createObjectURL(file));
		setIsUploading(true);

		try {
			// Get signed upload URL
			const { url, key } = await generateUploadUrl({ updateId });

			// Upload to R2
			const response = await fetch(url, {
				method: 'PUT',
				body: file,
				headers: {
					'Content-Type': file.type,
				},
			});

			if (!response.ok) {
				throw new Error('Upload failed');
			}

			// Sync metadata to update the database
			await syncMetadata({ key });

			onUploadComplete?.();
		} catch (error) {
			console.error('Upload error:', error);
			alert('Failed to upload image. Please try again.');
			setPreviewUrl(null);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const handleRemovePreview = () => {
		setPreviewUrl(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const displayUrl = previewUrl ?? coverImageUrl;

	return (
		<div className='flex flex-col gap-2'>
			<label className='text-sm font-medium'>Cover Image</label>

			{displayUrl ? (
				<div className='relative'>
					<img src={displayUrl} alt='Cover image' className='w-full bg-muted object-cover' />
					{isUploading && (
						<div className='absolute inset-0 flex items-center justify-center bg-black/50'>
							<Loader2 className='h-8 w-8 animate-spin text-white' />
						</div>
					)}
					{!isUploading && (
						<div className='absolute top-2 right-2 flex gap-2'>
							<Button
								type='button'
								variant='secondary'
								size='sm'
								onClick={() => fileInputRef.current?.click()}
							>
								Change
							</Button>
						</div>
					)}
				</div>
			) : (
				<button
					type='button'
					onClick={() => fileInputRef.current?.click()}
					disabled={isUploading}
					className={cn(
						'flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary',
						isUploading && 'cursor-not-allowed opacity-50'
					)}
				>
					{isUploading ? (
						<>
							<Loader2 className='h-8 w-8 animate-spin' />
							<span>Uploading...</span>
						</>
					) : (
						<>
							<ImagePlus className='h-8 w-8' />
							<span>Click to upload cover image</span>
							<span className='text-xs'>PNG, JPG up to 5MB</span>
						</>
					)}
				</button>
			)}

			<input
				ref={fileInputRef}
				type='file'
				accept='image/*'
				onChange={handleFileSelect}
				className='hidden'
			/>

			<p className='text-xs text-muted-foreground'>
				Recommended size: 1200x500px for best display across devices.
			</p>
		</div>
	);
}
