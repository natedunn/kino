import type { ComponentType } from 'react';

export type CommandGroupName = 'Global' | 'Navigation' | 'Feedback' | 'Files';

export type AppCommand = {
	id: string;
	title: string;
	group: CommandGroupName;
	contextual?: boolean;
	icon?: ComponentType<{ className?: string }>;
	keywords?: Array<string>;
	shortcut?: string;
	disabled?: boolean;
	closeOnRun?: boolean;
	run: () => void | Promise<void>;
};

export type CommandRegistration = {
	scopeId: string;
	commands: Array<AppCommand>;
};
