import { useState } from 'react';

/**
 * Hook for managing collapsible sidebar section state with localStorage persistence.
 *
 * @param storageKey - Unique key for localStorage persistence
 * @param defaultState - Default open/closed state for each section
 */
export function useSidebarState<T extends Record<string, boolean>>(
	storageKey: string,
	defaultState: T
) {
	const [state, setState] = useState<T>(() => {
		if (typeof window === 'undefined') return defaultState;
		try {
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				return { ...defaultState, ...JSON.parse(stored) };
			}
		} catch {
			// Ignore parse errors
		}
		return defaultState;
	});

	const setSection = (section: keyof T, open: boolean) => {
		setState((prev) => {
			const next = { ...prev, [section]: open };
			try {
				localStorage.setItem(storageKey, JSON.stringify(next));
			} catch {
				// Ignore storage errors
			}
			return next;
		});
	};

	return { state, setSection };
}
