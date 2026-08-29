import { describe, expect, it } from 'vitest';

import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { paraglideMiddleware } from '@/paraglide/server.js';

import { withDetectedLocalePreference } from './locale';

async function renderRequest(headers: HeadersInit = {}) {
	const request = withDetectedLocalePreference(
		new Request('https://kino.test/i18n-spike', { headers })
	);

	return paraglideMiddleware(request, () => {
		const locale = getLocale();
		return new Response(
			`<!doctype html><html lang="${locale}"><title>${m.spike_title()}</title></html>`
		);
	});
}

describe('request-scoped SSR locale', () => {
	it('falls back safely when rendering outside request middleware on the server', () => {
		expect(getLocale()).toBe('en-US');
	});

	it.each([
		['es-ES', 'es-419', 'Prueba de internacionalización'],
		['zh-Hant', 'zh-Hans', '国际化技术验证'],
		['fr-FR', 'en-US', 'Internationalization spike'],
	] as const)('maps browser preference %s to %s', async (preference, locale, title) => {
		const response = await renderRequest({ 'accept-language': preference });
		const html = await response.text();

		expect(html).toContain(`<html lang="${locale}">`);
		expect(html).toContain(`<title>${title}</title>`);
	});

	it('lets an explicit cookie override the browser preference', async () => {
		const response = await renderRequest({
			'accept-language': 'es-MX',
			cookie: 'PARAGLIDE_LOCALE=zh-Hans',
		});

		expect(await response.text()).toContain('<html lang="zh-Hans">');
	});

	it('uses Cloudflare region before browser preference when no choice is saved', async () => {
		const response = await renderRequest({
			'accept-language': 'en-US',
			'cf-ipcountry': 'MX',
		});

		expect(await response.text()).toContain('<html lang="es-419">');
	});

	it('keeps simultaneous request locales isolated', async () => {
		const [spanish, chinese] = await Promise.all([
			renderRequest({ 'accept-language': 'es-CO' }).then((response) => response.text()),
			renderRequest({ 'accept-language': 'zh-TW' }).then((response) => response.text()),
		]);

		expect(spanish).toContain('lang="es-419"');
		expect(spanish).not.toContain('国际化技术验证');
		expect(chinese).toContain('lang="zh-Hans"');
		expect(chinese).not.toContain('Prueba de internacionalización');
	});
});
