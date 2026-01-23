import { useConvexMutation } from '@convex-dev/react-query';
import { useMutation } from '@tanstack/react-query';

import { api } from '~api';
import { EmoteButton, EmotePicker, type EmoteContent, type EmoteCounts } from '@/components/emote';
import { Id } from '@/convex/_generated/dataModel';

type UpdateEmotesProps = {
	updateId: Id<'update'>;
	emoteCounts: EmoteCounts;
	currentProfileId?: string;
};

export function UpdateEmotes({ updateId, emoteCounts, currentProfileId }: UpdateEmotesProps) {
	const { mutate: toggleEmote } = useMutation({
		mutationFn: useConvexMutation(api.updateEmote.toggle),
	});

	const handleSelect = (emoteType: EmoteContent) => {
		toggleEmote({
			updateId,
			content: emoteType,
		});
	};

	const handleClick = (emoteType: EmoteContent) => {
		toggleEmote({
			updateId,
			content: emoteType,
		});
	};

	const emoteEntries = Object.entries(emoteCounts) as [
		EmoteContent,
		{ count: number; authorProfileIds: string[] },
	][];

	return (
		<div className='flex items-center gap-2'>
			<EmotePicker onSelect={handleSelect} disabled={!currentProfileId} />
			{emoteEntries.map(([emoteType, data]) => (
				<EmoteButton
					key={emoteType}
					emoteType={emoteType}
					count={data.count}
					isActive={currentProfileId ? data.authorProfileIds.includes(currentProfileId) : false}
					onClick={() => handleClick(emoteType)}
					disabled={!currentProfileId}
				/>
			))}
		</div>
	);
}
