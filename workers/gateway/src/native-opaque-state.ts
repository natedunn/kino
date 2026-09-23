export const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const AUTHORIZATION_URL_BUDGET = 1024; // App budget, not a documented GitHub limit.
export type StateStore = {
	getByName: (name: string) => {
		create: (envelope: string) => Promise<boolean>;
		consume: () => Promise<string | null>;
	};
};
export function newReference() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}
export async function referenceName(reference: string) {
	if (!REFERENCE_PATTERN.test(reference)) throw new Error('Invalid state reference');
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reference));
	return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
