import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { localizeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import * as m from '@/paraglide/messages.js';

export function CoverImageUpload({
	currentCoverImageUrl,
	onChange,
	onError,
	uploadFile,
	clearCover,
}: {
	currentCoverImageUrl?: string | null;
	onChange: (value: string | null) => void;
	onError?: (message: string) => void;
	uploadFile: (file: File) => Promise<string>;
	clearCover: () => Promise<unknown>;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			onError?.(m.updates_cover_select_image());
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			onError?.(m.updates_cover_too_large());
			return;
		}

		setPreviewUrl(URL.createObjectURL(file));
		setIsUploading(true);
		onError?.('');

		try {
			onChange(await uploadFile(file));
		} catch (error) {
			onError?.(localizeError(error, m.updates_cover_failed()));
			setPreviewUrl(null);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	const displayUrl = previewUrl ?? currentCoverImageUrl;
	const isBusy = isUploading;

	const handleClear = async () => {
		setIsUploading(true);
		onError?.('');

		try {
			await clearCover();
			setPreviewUrl(null);
			onChange(null);
		} catch (error) {
			onError?.(localizeError(error, m.updates_cover_clear_failed()));
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
	};

	return (
		<div className='flex flex-col gap-2'>
			<label className='text-sm font-medium'>{m.updates_cover_image()}</label>

			{displayUrl ? (
				<div className='relative'>
					<img
						alt={m.updates_cover_alt()}
						className='w-full bg-muted object-cover'
						src={displayUrl}
					/>
					{isBusy ? (
						<div className='absolute inset-0 flex items-center justify-center bg-black/50'>
							<Loader2 className='h-8 w-8 animate-spin text-white' />
						</div>
					) : (
						<div className='absolute top-2 right-2 flex gap-2'>
							<Button
								onClick={() => fileInputRef.current?.click()}
								size='sm'
								type='button'
								variant='secondary'
							>
								{m.updates_cover_change()}
							</Button>
							<Button onClick={handleClear} size='sm' type='button' variant='secondary'>
								<Trash2 className='size-3.5' />
								{m.updates_cover_clear()}
							</Button>
						</div>
					)}
				</div>
			) : (
				<button
					className={cn(
						'flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary',
						isBusy && 'cursor-not-allowed opacity-50'
					)}
					disabled={isBusy}
					onClick={() => fileInputRef.current?.click()}
					type='button'
				>
					{isBusy ? (
						<>
							<Loader2 className='h-8 w-8 animate-spin' />
							<span>{m.updates_cover_uploading()}</span>
						</>
					) : (
						<>
							<ImagePlus className='h-8 w-8' />
							<span>{m.updates_cover_choose()}</span>
							<span className='text-xs'>{m.updates_cover_formats()}</span>
						</>
					)}
				</button>
			)}

			<input
				accept='image/*'
				className='hidden'
				onChange={handleFileSelect}
				ref={fileInputRef}
				type='file'
			/>

			<p className='text-xs text-muted-foreground'>{m.updates_cover_recommended()}</p>
		</div>
	);
}
