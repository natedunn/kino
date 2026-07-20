export type ThemePreference = 'dark' | 'light';

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
	for (const listener of themeListeners) listener();
}

export function setThemePreference(theme: ThemePreference) {
	if (typeof document === 'undefined') return;

	document.documentElement.classList.add('disable-transitions');

	if (theme === 'dark') {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}

	try {
		localStorage.theme = theme;
	} catch {
		// Accessing localStorage can throw (Safari private mode, blocked
		// storage). The class change above still applies for this session.
	}

	notifyThemeListeners();

	window.setTimeout(() => {
		document.documentElement.classList.remove('disable-transitions');
	}, 10);
}

// Subscribe helper for `useSyncExternalStore`, so components can read the
// active theme synchronously (no post-mount flash) and stay in sync when it
// changes here, in another tab, or via the OS color-scheme preference.
export function subscribeThemePreference(onChange: () => void) {
	themeListeners.add(onChange);

	const media =
		typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

	const handleExternalChange = () => onChange();
	window.addEventListener('storage', handleExternalChange);
	media?.addEventListener('change', handleExternalChange);

	return () => {
		themeListeners.delete(onChange);
		window.removeEventListener('storage', handleExternalChange);
		media?.removeEventListener('change', handleExternalChange);
	};
}

// Server snapshot for `useSyncExternalStore` — matches the default the document
// renders with before client-side hydration.
export function getServerThemePreference(): ThemePreference {
	return 'light';
}

export function getCurrentThemePreference(): ThemePreference {
	if (typeof document === 'undefined') return 'light';

	if (document.documentElement.classList.contains('dark')) {
		return 'dark';
	}

	try {
		if (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
	} catch {
		// localStorage may be inaccessible; fall back to system preference.
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
	}

	return 'light';
}

export function toggleThemePreference() {
	setThemePreference(getCurrentThemePreference() === 'dark' ? 'light' : 'dark');
}
