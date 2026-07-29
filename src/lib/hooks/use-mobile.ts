import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
	return useIsBelow(MOBILE_BREAKPOINT);
}

// True while the viewport is narrower than `breakpoint` (px). Matches SSR's
// `false` until mounted so the desktop layout renders first (avoids hydration
// mismatch), then corrects on the client.
export function useIsBelow(breakpoint: number) {
	const [isBelow, setIsBelow] = React.useState<boolean | undefined>(undefined);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
		const onChange = () => setIsBelow(window.innerWidth < breakpoint);
		mql.addEventListener('change', onChange);
		setIsBelow(window.innerWidth < breakpoint);
		return () => mql.removeEventListener('change', onChange);
	}, [breakpoint]);

	return !!isBelow;
}
