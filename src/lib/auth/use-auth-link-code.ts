import { useEffect, useState } from 'react';

export function parseAuthLinkCode(fragment: string) {
	const value = new URLSearchParams(fragment.replace(/^#/, '')).get('code');
	return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

/** Read a native auth proof from the URL fragment, then remove it from history. */
export function useAuthLinkCode(enabled: boolean) {
	const [code, setCode] = useState<string | null | undefined>(enabled ? undefined : null);

	useEffect(() => {
		if (!enabled) return;
		setCode(parseAuthLinkCode(window.location.hash));
		history.replaceState(null, '', window.location.pathname + window.location.search);
	}, [enabled]);

	return code;
}
