import { createContext } from 'react';
import type { AppCommand } from './types';


export type CommandContextValue = {
	close: () => void;
	open: () => void;
	registerCommands: (scopeId: string, commands: Array<AppCommand>) => () => void;
};

export const CommandContext = createContext<CommandContextValue | null>(null);
