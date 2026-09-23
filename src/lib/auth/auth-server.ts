import {
	getNativeServerAuthToken,
	handleNativeAuthRequest,
} from '@/lib/auth/adapters/native-server';

/** Stable server boundary used by TanStack Start and auth HTTP routes. */
export async function handleAuthRequest(request: Request) {
	return handleNativeAuthRequest(request);
}

export async function getServerAuthToken() {
	return getNativeServerAuthToken();
}
