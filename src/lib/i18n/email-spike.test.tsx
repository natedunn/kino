import { renderToStaticMarkup } from 'react-dom/server.edge';
import { describe, expect, it } from 'vitest';

import { m } from '@/paraglide/messages.js';

function EmailSpike({ locale }: { locale: 'en-US' | 'es-419' | 'zh-Hans' }) {
	return (
		<html lang={locale}>
			<body>
				<h1>{m.spike_email_subject({}, { locale })}</h1>
				<p>{m.spike_email_body({ name: 'Ada' }, { locale })}</p>
			</body>
		</html>
	);
}

describe('localized email spike', () => {
	it.each([
		['en-US', 'Your Kino workspace is ready'],
		['es-419', 'Tu espacio de trabajo de Kino está listo'],
		['zh-Hans', '你的 Kino 工作区已准备就绪'],
	] as const)('renders %s with the edge-compatible React renderer', (locale, expected) => {
		const html = renderToStaticMarkup(<EmailSpike locale={locale} />);

		expect(html).toContain(`lang="${locale}"`);
		expect(html).toContain(expected);
	});
});
