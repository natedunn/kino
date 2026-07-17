import {
	compareTargets,
	formatTarget,
	formatTargetOrUnscheduled,
	isValidTarget,
	resolveTarget,
} from '@convex/target';
import { describe, expect, it } from 'vitest';

describe('target helpers', () => {
	it('validates tokens by granularity', () => {
		expect(isValidTarget('2026-03-15', 'day')).toBe(true);
		expect(isValidTarget('2026-03', 'month')).toBe(true);
		expect(isValidTarget('2026-Q1', 'quarter')).toBe(true);
		expect(isValidTarget('2026', 'year')).toBe(true);

		expect(isValidTarget('2026-Q1', 'day')).toBe(false);
		expect(isValidTarget('2026-13', 'month')).toBe(false);
		expect(isValidTarget('2026-Q5', 'quarter')).toBe(false);
		expect(isValidTarget('26', 'year')).toBe(false);
	});

	it('resolves day targets', () => {
		expect(resolveTarget('2026-03-15', 'day')).toEqual({
			end: '2026-03-15',
			start: '2026-03-15',
		});
	});

	it('resolves month boundaries without timezone round trips', () => {
		expect(resolveTarget('2026-03', 'month')).toEqual({
			end: '2026-03-31',
			start: '2026-03-01',
		});
		expect(resolveTarget('2026-04', 'month')).toEqual({
			end: '2026-04-30',
			start: '2026-04-01',
		});
	});

	it('handles leap-year February', () => {
		expect(resolveTarget('2024-02', 'month')).toEqual({
			end: '2024-02-29',
			start: '2024-02-01',
		});
		expect(resolveTarget('2026-02', 'month')).toEqual({
			end: '2026-02-28',
			start: '2026-02-01',
		});
		expect(isValidTarget('2024-02-29', 'day')).toBe(true);
		expect(isValidTarget('2026-02-29', 'day')).toBe(false);
	});

	it('resolves quarter boundaries', () => {
		expect(resolveTarget('2026-Q1', 'quarter')).toEqual({
			end: '2026-03-31',
			start: '2026-01-01',
		});
		expect(resolveTarget('2026-Q4', 'quarter')).toEqual({
			end: '2026-12-31',
			start: '2026-10-01',
		});
	});

	it('formats target labels', () => {
		expect(formatTarget('2026-03-15', 'day')).toBe('Mar 15, 2026');
		expect(formatTarget('2026-03', 'month')).toBe('March 2026');
		expect(formatTarget('2026-Q1', 'quarter')).toBe('Q1 2026');
		expect(formatTarget('2026', 'year')).toBe('2026');
		expect(formatTargetOrUnscheduled(null, null)).toBe('Unscheduled');
	});

	it('sorts by start date, then precise to broad, with unscheduled last', () => {
		const values = [
			null,
			{ granularity: 'quarter' as const, target: '2026-Q1' },
			{ granularity: 'day' as const, target: '2026-01-01' },
			{ granularity: 'month' as const, target: '2026-01' },
			{ granularity: 'year' as const, target: '2026' },
			{ granularity: 'day' as const, target: '2025-12-31' },
		].sort(compareTargets);

		expect(values).toEqual([
			{ granularity: 'day', target: '2025-12-31' },
			{ granularity: 'day', target: '2026-01-01' },
			{ granularity: 'month', target: '2026-01' },
			{ granularity: 'quarter', target: '2026-Q1' },
			{ granularity: 'year', target: '2026' },
			null,
		]);
	});
});
