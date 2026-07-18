
import * as React from 'react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

import { getCurrentThemePreference } from '@/lib/theme';

const Toaster = ({ ...props }: ToasterProps) => {
	const [theme, setTheme] = React.useState<ToasterProps['theme']>('light');
	const isDark = theme === 'dark';

	React.useEffect(() => {
		const updateTheme = () => {
			setTheme(getCurrentThemePreference());
		};

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributeFilter: ['class'],
			attributes: true,
		});

		return () => observer.disconnect();
	}, []);

	return (
		<Sonner
			theme={theme}
			position='bottom-right'
			className='toaster group'
			style={
				{
					'--normal-bg': isDark ? 'oklch(0.22 0 0)' : 'var(--popover)',
					'--normal-text': isDark ? 'oklch(0.985 0 0)' : 'var(--popover-foreground)',
					'--normal-border': isDark ? 'oklch(0.42 0 0)' : 'var(--border)',
					'--success-bg': isDark ? 'oklch(0.3 0.095 155)' : 'oklch(0.97 0.035 155)',
					'--success-text': isDark ? 'oklch(0.93 0.06 155)' : 'oklch(0.33 0.12 155)',
					'--success-border': isDark ? 'oklch(0.55 0.13 155)' : 'oklch(0.78 0.11 155)',
					'--info-bg': isDark ? 'oklch(0.31 0.09 255)' : 'oklch(0.97 0.035 255)',
					'--info-text': isDark ? 'oklch(0.92 0.055 255)' : 'oklch(0.34 0.12 255)',
					'--info-border': isDark ? 'oklch(0.56 0.13 255)' : 'oklch(0.78 0.1 255)',
					'--warning-bg': isDark ? 'oklch(0.32 0.075 75)' : 'oklch(0.98 0.05 85)',
					'--warning-text': isDark ? 'oklch(0.94 0.08 85)' : 'oklch(0.42 0.11 75)',
					'--warning-border': isDark ? 'oklch(0.64 0.13 75)' : 'oklch(0.82 0.12 80)',
					'--error-bg': isDark ? 'oklch(0.31 0.095 25)' : 'oklch(0.97 0.04 25)',
					'--error-text': isDark ? 'oklch(0.93 0.06 25)' : 'oklch(0.42 0.14 25)',
					'--error-border': isDark ? 'oklch(0.58 0.16 25)' : 'oklch(0.78 0.13 25)',
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
