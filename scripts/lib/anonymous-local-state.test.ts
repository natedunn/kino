import { describe, expect, it } from 'vitest';

import { planLocalDeploymentReset, shouldStopLocalBackend } from './anonymous-local-state.mjs';

describe('anonymous local seed state', () => {
	it('keeps stop-only behavior non-destructive for the expected deployment', () => {
		expect(
			shouldStopLocalBackend({
				resetLocalState: false,
				stopRunningLocal: true,
				target: null,
			})
		).toBe(true);
		expect(planLocalDeploymentReset('anonymous-agent', { resetLocalState: false })).toBeNull();
	});

	it('stops and resets when a fresh local seed is explicit', () => {
		expect(
			shouldStopLocalBackend({
				resetLocalState: true,
				stopRunningLocal: false,
				target: null,
			})
		).toBe(true);
		expect(planLocalDeploymentReset('anonymous-agent', { resetLocalState: true })).toEqual({
			reason: 'fresh local seed requested',
		});
	});

	it('repairs a mismatched anonymous deployment without an explicit reset', () => {
		expect(planLocalDeploymentReset('anonymous-worktree', { resetLocalState: false })).toEqual({
			reason: 'local deployment is "anonymous-worktree", not "anonymous-agent"',
		});
	});

	it('does not stop a backend for an explicit target', () => {
		expect(
			shouldStopLocalBackend({
				resetLocalState: true,
				stopRunningLocal: true,
				target: 'local',
			})
		).toBe(false);
	});
});
