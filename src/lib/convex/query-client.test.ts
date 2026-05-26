import { describe, expect, it } from 'vitest';

import { convexQueryKeyHashFn } from './query-client';

describe('convexQueryKeyHashFn', () => {
  it('hashes Convex object args independent of property insertion order', () => {
    const first = convexQueryKeyHashFn([
      'convexQuery',
      'feedback:listProjectFeedback',
      {
        boardId: 'all',
        cursor: null,
        limit: 50,
        projectId: 'project_123',
        search: undefined,
        status: undefined,
      },
    ]);

    const second = convexQueryKeyHashFn([
      'convexQuery',
      'feedback:listProjectFeedback',
      {
        boardId: 'all',
        projectId: 'project_123',
        search: undefined,
        status: undefined,
        cursor: null,
        limit: 50,
      },
    ]);

    expect(second).toBe(first);
  });
});
