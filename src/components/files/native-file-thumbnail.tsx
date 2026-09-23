import type { Id } from '../../../convex/native/_generated/dataModel';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { FileImage } from 'lucide-react';

import { api } from '../../../convex/native/_generated/api';

export function NativeFileThumbnail({
	assetId,
	publicUrl,
}: {
	assetId: string;
	publicUrl: string | null;
}) {
	const download = useAction(api.filesTransport.download);
	const [failed, setFailed] = useState(false);
	const { data } = useQuery({
		queryKey: ['native-file-thumbnail', assetId],
		enabled: !publicUrl,
		queryFn: () =>
			download({ assetId: assetId as Id<'fileAssets'>, thumbnail: true, inline: true }),
		staleTime: 45000,
		refetchInterval: publicUrl ? false : 45000,
	});
	const url = publicUrl || data;
	return url && !failed ? (
		<img
			alt=''
			className='size-full object-cover'
			decoding='async'
			loading='lazy'
			onError={() => setFailed(true)}
			src={url}
		/>
	) : (
		<FileImage className='size-4 text-muted-foreground' />
	);
}
