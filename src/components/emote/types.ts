// Emote types matching the schema
export type EmoteContent =
	| 'thumbsUp'
	| 'thumbsDown'
	| 'laugh'
	| 'questionMark'
	| 'sad'
	| 'tada'
	| 'eyes'
	| 'heart'
	| 'skull'
	| 'explodingHead';

// Map emote types to emoji characters
export const EMOTE_EMOJI: Record<EmoteContent, string> = {
	thumbsUp: '👍',
	thumbsDown: '👎',
	laugh: '😄',
	questionMark: '❓',
	sad: '🙁',
	tada: '🎉',
	eyes: '👀',
	heart: '❤️',
	skull: '💀',
	explodingHead: '🤯',
};

export type EmoteCounts = Record<string, { count: number; authorProfileIds: string[] }>;
