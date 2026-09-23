import type { Id } from '../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAction, useMutation } from 'convex/react';

import * as m from '@/paraglide/messages.js';
import { CoverImageUpload } from '@/routes/@{$org}/$project/updates/-components/cover-image-upload';

import { api } from '../../../convex/native/_generated/api';

function useImageUrl(assetId?: Id<'fileAssets'>, thumbnail = false) {
	const download = useAction(api.filesTransport.download);
	return useQuery({
		queryKey: ['native-file-image', assetId, thumbnail],
		enabled: !!assetId,
		queryFn: () => download({ assetId: assetId!, thumbnail, inline: true }),
		staleTime: 45000,
		refetchInterval: 45000,
		retry: false,
	}).data;
}
export function NativeFileImage({
	assetId,
	thumbnail = false,
	alt = '',
	className,
}: {
	assetId: Id<'fileAssets'>;
	thumbnail?: boolean;
	alt?: string;
	className?: string;
}) {
	const url = useImageUrl(assetId, thumbnail);
	return url ? (
		<img
			src={url}
			alt={alt}
			className={
				className ??
				(thumbnail ? 'size-16 rounded object-cover' : 'max-h-96 w-full rounded object-contain')
			}
			loading='lazy'
		/>
	) : null;
}
export function NativeCoverImageUpload({
	projectId,
	updateId,
	assetId,
}: {
	projectId: Id<'projects'>;
	updateId: Id<'updates'>;
	assetId?: Id<'fileAssets'>;
}) {
	const start = useAction(api.filesTransport.start),
		complete = useAction(api.filesTransport.complete),
		remove = useMutation(api.files.removeCover);
	const [error, setError] = useState('');
	const url = useImageUrl(assetId);
	return (
		<>
			<CoverImageUpload
				currentCoverImageUrl={url}
				onError={setError}
				onChange={() => undefined}
				clearCover={() => remove({ updateId })}
				uploadFile={async (file) => {
					const [intent] = await start({
						projectId,
						updateId,
						files: [{ name: file.name, mimeType: file.type, sizeBytes: file.size }],
					});
					const response = await fetch(intent.url, {
						method: 'PUT',
						headers: { 'content-type': intent.mimeType },
						body: file,
					});
					if (!response.ok) throw new Error(m.updates_cover_upload_failed());
					await complete({ assetId: intent.assetId });
					return intent.assetId;
				}}
			/>
			{error && (
				<p role='alert' className='text-sm text-destructive'>
					{error}
				</p>
			)}
		</>
	);
}
