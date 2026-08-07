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
