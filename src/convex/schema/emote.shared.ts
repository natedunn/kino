import * as z from 'zod';

// Shared emote types used across feedbackCommentEmote, updateEmote, and updateCommentEmote
export const emoteContentSchema = z.enum([
	// 👍 👎 😄 ❓ 🙁 🎉 👀 ❤️ 💀 🤯
	'thumbsUp',
	'thumbsDown',
	'laugh',
	'questionMark',
	'sad',
	'tada',
	'eyes',
	'heart',
	'skull',
	'explodingHead',
]);

export type EmoteContent = z.infer<typeof emoteContentSchema>;
