// Cookie credentials stay HttpOnly. Only a session-change notice crosses tabs.
const channelName = 'convex-v2-proof-session';
let sender: string | undefined;
const getSender = () => (sender ??= crypto.randomUUID());
export function announceSessionChange() {
	const channel = new BroadcastChannel(channelName);
	channel.postMessage({ type: 'changed', sender: getSender() });
	channel.close();
}
export function restartSession() {
	// Hide old private data before navigation. A new document owns a new QueryClient.
	document.body.style.visibility = 'hidden';
	window.location.replace(window.location.href);
}
export function watchSessionChanges() {
	if (window.location.hash === '#session-changed') {
		history.replaceState(null, '', window.location.pathname + window.location.search);
		announceSessionChange();
	}
	const channel = new BroadcastChannel(channelName);
	channel.onmessage = (event) => {
		if (event.data?.type === 'changed' && event.data.sender !== getSender()) restartSession();
	};
	return () => channel.close();
}
// Used only to detect a UI identity transition; backend verification remains authoritative.
export function tokenSubject(token: string | null | undefined): string | null {
	if (!token) return null;
	try {
		return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub ?? null;
	} catch {
		return null;
	}
}
