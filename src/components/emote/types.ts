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

export type EmoteCounts = Record<string, { authorProfileIds: string[]; count: number }>;
