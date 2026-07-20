import type { AppCommand } from './types';

import { useContext, useEffect } from 'react';

import { CommandContext } from './command-context';

export function useCommandPalette() {
	const context = useContext(CommandContext);

	if (!context) {
		throw new Error('useCommandPalette must be used within CommandProvider');
	}

	return {
		close: context.close,
		open: context.open,
	};
}

/**
 * Registers a set of contextual commands for the lifetime of the calling
 * component, keyed by `scopeId` (re-registering the same scope replaces it).
 *
 * IMPORTANT: `commands` is compared by reference. Always pass a memoized array
 * (e.g. `useMemo`) — an inline array re-registers on every render, which loops
 * provider state updates and re-renders the whole tree.
 */
export function useRegisterCommands(scopeId: string, commands: Array<AppCommand>) {
	const context = useContext(CommandContext);

	if (!context) {
		throw new Error('useRegisterCommands must be used within CommandProvider');
	}

	useEffect(() => {
		return context.registerCommands(scopeId, commands);
	}, [commands, context, scopeId]);
}
