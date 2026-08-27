import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

import { withDetectedLocalePreference } from '@/lib/i18n/locale';
import { paraglideMiddleware } from '@/paraglide/server.js';

export default createServerEntry({
	fetch(request: Request): Promise<Response> {
		const localizedRequest = withDetectedLocalePreference(request);
		return paraglideMiddleware(localizedRequest, () => handler.fetch(localizedRequest));
	},
});
