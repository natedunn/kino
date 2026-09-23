import type { TokenBundle } from '../.revocation/packages/core/src/lib/types';

import { ConvexHttpClient } from 'convex/browser';

import { api } from './convex/_generated/api';

const client = new ConvexHttpClient('http://127.0.0.1:4420');
const status = document.querySelector('#status')!;
const input = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
let tokens: TokenBundle | null = JSON.parse(sessionStorage.getItem('proof-session') || 'null');
const fragment = new URLSearchParams(location.hash.slice(1));
history.replaceState(null, '', location.pathname);
const show = (value: unknown) => {
	status.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};
async function run(work: () => Promise<unknown>) {
	try {
		show(await work());
	} catch {
		show('Request failed. Check proof logs for the error category.');
	}
}
async function accept(result: { status: string; tokens?: TokenBundle }) {
	if (result.tokens) {
		tokens = result.tokens;
		sessionStorage.setItem('proof-session', JSON.stringify(tokens));
	}
	return result.tokens ? check() : result.status;
}
async function check() {
	if (!tokens) return 'Signed out';
	const result = await client.mutation(api.auth.refreshSession, {
		refreshToken: tokens.refreshToken,
	});
	if (result.kind === 'noSession') {
		tokens = null;
		sessionStorage.removeItem('proof-session');
		client.clearAuth();
		return result.kind;
	}
	tokens = result.kind === 'rotated' ? result.tokens : { ...tokens, ...result };
	sessionStorage.setItem('proof-session', JSON.stringify(tokens));
	client.setAuth(tokens.accessToken);
	const user = await client.query(api.users.current, {});
	return user ? `Signed in: ${user.userId}; verified: ${user.verified}` : 'Signed out';
}
const credentials = () => ({ email: input('email'), password: input('password') });
document.querySelector('form')!.onsubmit = (e) => {
	e.preventDefault();
	void run(async () => accept(await client.mutation(api.auth.signIn, credentials())));
};
document.querySelector<HTMLButtonElement>('#signup')!.onclick = () =>
	void run(() => client.mutation(api.auth.signUp, credentials()));
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () =>
	void run(() =>
		client.mutation(api.auth.requestEmail, { email: input('email'), purpose: 'reset' })
	);
for (const [purpose, id] of [
	['verify', 'verify'],
	['reset', 'complete-reset'],
]) {
	const button = document.getElementById(id) as HTMLButtonElement;
	const code = fragment.get(purpose);
	button.hidden = !code;
	if (code)
		button.onclick = () =>
			void run(async () =>
				purpose === 'verify'
					? accept(await client.mutation(api.auth.verifyEmail, { code }))
					: client.mutation(api.auth.resetPassword, { code, password: input('password') })
			);
}
document.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => void run(check);
document.querySelector<HTMLButtonElement>('#logout')!.onclick = () =>
	void run(async () => {
		if (tokens) await client.mutation(api.auth.signOut, { refreshToken: tokens.refreshToken });
		tokens = null;
		sessionStorage.removeItem('proof-session');
		client.clearAuth();
		return 'Signed out';
	});
void run(check);
