import handler from '@tanstack/react-start/server-entry';

import '@/lib/i18n/runtime';

import { paraglideMiddleware } from '@/paraglide/server.js';

export default {
	fetch(request: Request): Promise<Response> {
		return paraglideMiddleware(request, () => handler.fetch(request));
	},
};
