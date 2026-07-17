import type { AppCommand } from './types';

import { createContext } from 'react';

export type CommandContextValue = {
	close: () => void;
	open: () => void;
	registerCommands: (scopeId: string, commands: Array<AppCommand>) => () => void;
};

export const CommandContext = createContext<CommandContextValue | null>(null);
