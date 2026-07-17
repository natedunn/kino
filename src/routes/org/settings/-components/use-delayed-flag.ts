import { useEffect, useState } from 'react';

/**
 * Returns `true` only once `active` has stayed `true` for `delayMs`. Lets us
 * gate a loading skeleton so fast (near-instant) loads never flash it, while
 * genuinely slow ones still get an indicator.
 */
export function useDelayedFlag(active: boolean, delayMs = 200) {
	const [elapsed, setElapsed] = useState(false);

	useEffect(() => {
		if (!active) {
			setElapsed(false);
			return;
		}
		const timer = setTimeout(() => setElapsed(true), delayMs);
		return () => clearTimeout(timer);
	}, [active, delayMs]);

	return active && elapsed;
}
