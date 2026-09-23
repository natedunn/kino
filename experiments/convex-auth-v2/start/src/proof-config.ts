export const convexUrl = import.meta.env.VITE_PROOF_CONVEX_URL || 'http://127.0.0.1:4420';
export const appOrigin = import.meta.env.VITE_PROOF_APP_ORIGIN || 'https://127.0.0.1:5183';
export const routeId = import.meta.env.VITE_PROOF_ROUTE_ID || '';
export const allowedOrigins = routeId
	? [appOrigin]
	: ['http://127.0.0.1:5181', 'http://127.0.0.1:5182', 'https://127.0.0.1:5183'];
