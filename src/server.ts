import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

import { withDetectedLocalePreference } from '@/lib/i18n/locale';
import { withSecurityHeaders } from '@/lib/security/response-headers';
import { paraglideMiddleware } from '@/paraglide/server.js';

export default createServerEntry({
	async fetch(request: Request): Promise<Response> {
		const localizedRequest = withDetectedLocalePreference(request);
		const response = await paraglideMiddleware(localizedRequest, () =>
			handler.fetch(localizedRequest)
		);
		return withSecurityHeaders(localizedRequest, response);
	},
});
