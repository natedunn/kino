import { describe, expect, it } from 'vitest';

import { EMOTE_EMOJI } from '../../src/components/emote/types';
import { EMOTE_CONTENTS } from '../functions/schema';

// The client (`src/components/emote/types.ts`) keeps its own copy of the emote
// content list because it lives in a separate build context from the Convex
// server. `EMOTE_CONTENTS` (convex/functions/schema.ts) is the server source of
// truth — it backs the table validators and the mutation input schema. This
// test fails the moment the two drift, so adding (or removing) a reaction in
// one place can't silently desync the other.
describe('client/server emote-content parity', () => {
	it('keeps the emote content list identical', () => {
		// The client runtime list is the keys of `EMOTE_EMOJI`, which TypeScript
		// forces to cover the full `EmoteContent` union (it's a
		// `Record<EmoteContent, string>`). Sorted so a reorder isn't a failure.
		const clientContents = Object.keys(EMOTE_EMOJI).sort();
		const serverContents = [...EMOTE_CONTENTS].sort();

		expect(clientContents, 'emote content list drifted between client and server').toEqual(
			serverContents
		);
	});
});
