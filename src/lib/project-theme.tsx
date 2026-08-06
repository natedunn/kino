import type { ProjectThemeInput } from '@convex/project-theme';
import type { CSSProperties, ReactNode } from 'react';

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
	DEFAULT_PROJECT_THEME,
	PROJECT_THEME_VERSION,
	projectThemeCssVariables,
} from '@convex/project-theme';

type ThemeStyle = CSSProperties & Record<`--project-${string}`, string>;
type ProjectThemePreviewSetter = (theme: ProjectThemeInput | null) => void;

const ProjectThemeContext = createContext<ThemeStyle | null>(null);
const ProjectThemePreviewContext = createContext<ProjectThemePreviewSetter | null>(null);
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const THEMED_PROJECT_ROUTE_IDS = new Set([
	'/@{$org}/$project/',
	'/@{$org}/$project/discussions/',
	'/@{$org}/$project/feedback/',
	'/@{$org}/$project/feedback/$slug/',
	'/@{$org}/$project/feedback/boards/',
	'/@{$org}/$project/feedback/boards/$board/',
	'/@{$org}/$project/feedback/new/',
	'/@{$org}/$project/files/',
	'/@{$org}/$project/roadmap/',
	'/@{$org}/$project/settings/',
	'/@{$org}/$project/settings/appearance/',
	'/@{$org}/$project/settings/boards/',
	'/@{$org}/$project/settings/danger/',
	'/@{$org}/$project/settings/general/',
	'/@{$org}/$project/settings/integrations/',
	'/@{$org}/$project/settings/members/',
	'/@{$org}/$project/updates/',
	'/@{$org}/$project/updates/$slug/',
]);

export function isThemedProjectRoute(routeId: string | undefined) {
	return !!routeId && THEMED_PROJECT_ROUTE_IDS.has(routeId);
}

export function resolveProjectTheme(value: unknown): ProjectThemeInput {
	if (!value || typeof value !== 'object') return DEFAULT_PROJECT_THEME;
	const theme = value as Partial<ProjectThemeInput>;
	if (theme.version !== PROJECT_THEME_VERSION || !theme.light || !theme.dark || !theme.presetId) {
		return DEFAULT_PROJECT_THEME;
	}
	return theme as ProjectThemeInput;
}

export function ProjectThemeShell({
	children,
	theme,
}: {
	children: ReactNode;
	theme: ProjectThemeInput;
}) {
	const style = useMemo(() => projectThemeCssVariables(theme) as ThemeStyle, [theme]);
	return (
		<ProjectThemeContext.Provider value={style}>
			<div
				data-project-theme=''
				className='flex flex-1 flex-col bg-background text-foreground'
				style={style}
			>
				{children}
			</div>
		</ProjectThemeContext.Provider>
	);
}

export function ProjectThemeBoundary({
	children,
	theme,
}: {
	children: ReactNode;
	theme: ProjectThemeInput | null;
}) {
	const [previewTheme, setPreviewTheme] = useState<ProjectThemeInput | null>(null);
	const activeTheme = previewTheme ?? theme ?? DEFAULT_PROJECT_THEME;
	return (
		<ProjectThemePreviewContext.Provider value={setPreviewTheme}>
			<ProjectThemeShell theme={activeTheme}>{children}</ProjectThemeShell>
		</ProjectThemePreviewContext.Provider>
	);
}

/** Returns a client-only preview setter and clears its override when the editor unmounts. */
export function useProjectThemePreview() {
	const setPreviewTheme = useContext(ProjectThemePreviewContext);
	useIsomorphicLayoutEffect(
		() => () => {
			setPreviewTheme?.(null);
		},
		[setPreviewTheme]
	);
	return setPreviewTheme;
}

export function useProjectThemeStyle(): ThemeStyle | undefined {
	return useContext(ProjectThemeContext) ?? undefined;
}
