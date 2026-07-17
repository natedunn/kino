import type { ReactNode } from 'react';
import type { Shortcut, ShortcutRegistration } from './types';

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { hasReservedModifier, isEditableTarget, isOverlayOpen, normalizeKey } from './keys';
import { ShortcutsContext } from './shortcuts-context';

const ShortcutsDialog = lazy(async () => {
	const { ShortcutsDialog } = await import('./shortcuts-dialog');
	return { default: ShortcutsDialog };
});

export function ShortcutsProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [registrations, setRegistrations] = useState<Array<ShortcutRegistration>>([]);

	const registerShortcuts = useCallback((scopeId: string, shortcuts: Array<Shortcut>) => {
		setRegistrations((current) => [
			...current.filter((registration) => registration.scopeId !== scopeId),
			{ scopeId, shortcuts },
		]);

		return () => {
			setRegistrations((current) =>
				current.filter((registration) => registration.scopeId !== scopeId)
			);
		};
	}, []);

	const contextValue = useMemo(
		() => ({
			close: () => setOpen(false),
			open: () => setOpen(true),
			toggle: () => setOpen((current) => !current),
			registerShortcuts,
		}),
		[registerShortcuts]
	);

	// The "?" shortcut lives globally so it works on every page and is always
	// documented in the modal. Page-specific shortcuts are layered on top and win
	// when they share a key.
	const globalShortcuts = useMemo<Array<Shortcut>>(
		() => [
			{
				id: 'global.command-menu',
				group: 'Global',
				keys: [],
				label: '⌘ K',
				description: 'Open command menu',
			},
			{
				id: 'global.shortcuts',
				group: 'Global',
				keys: ['?'],
				description: 'Show keyboard shortcuts',
				run: () => setOpen((current) => !current),
			},
		],
		[]
	);

	const shortcuts = useMemo(
		() => [...globalShortcuts, ...registrations.flatMap((registration) => registration.shortcuts)],
		[globalShortcuts, registrations]
	);

	// Last write wins, so a page-specific shortcut transparently overrides a
	// global one bound to the same key.
	const keyMap = useMemo(() => {
		const map = new Map<string, Shortcut>();

		for (const shortcut of shortcuts) {
			if (shortcut.enabled && !shortcut.enabled()) continue;
			if (!shortcut.run) continue;

			for (const key of shortcut.keys) {
				map.set(normalizeKey(key), shortcut);
			}
		}

		return map;
	}, [shortcuts]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.isComposing) return;
			if (event.repeat) return;
			if (hasReservedModifier(event)) return;
			if (isEditableTarget(event.target)) return;

			const key = normalizeKey(event.key);

			// While the modal is open only the toggle key is live; everything else is
			// left to the dialog (Escape, focus trap, etc.).
			if (open && key !== '?') return;

			// "?" is the global help toggle and stays live everywhere. Any other
			// single key is suppressed while a dialog/menu/popover is open so it can't
			// trigger navigation underneath the open layer.
			if (key !== '?' && isOverlayOpen()) return;

			const shortcut = keyMap.get(key);
			if (!shortcut?.run) return;

			event.preventDefault();
			Promise.resolve(shortcut.run({ event, key })).catch((error) => {
				console.error(`Shortcut "${shortcut.id}" failed:`, error);
			});
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [keyMap, open]);

	return (
		<ShortcutsContext.Provider value={contextValue}>
			{children}
			{open ? (
				<Suspense fallback={null}>
					<ShortcutsDialog open={open} onOpenChange={setOpen} shortcuts={shortcuts} />
				</Suspense>
			) : null}
		</ShortcutsContext.Provider>
	);
}
