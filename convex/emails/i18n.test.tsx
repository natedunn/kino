import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { describe, expect, it } from 'vitest';

import { resolveRequestLocale } from '../shared/i18n';
import { getEmailCopy } from './i18n';
import { OrganizationInvitationEmail, ResetPasswordEmail, VerificationEmail } from './index';

describe('transactional email localization', () => {
	it.each([
		['en-US', 'Verify your email', 'If the button doesn’t work'],
		['es-419', 'Verifica tu correo', 'Si el botón no funciona'],
		['zh-Hans', '验证电子邮件', '如果按钮无法使用'],
	] as const)('renders verification email in %s', (locale, heading, fallback) => {
		const html = renderToStaticMarkup(
			createElement(VerificationEmail, {
				locale,
				url: 'https://example.com/verify',
				user: { email: 'ada@example.com', name: 'Ada' },
			})
		);
		expect(html).toContain(`lang="${locale}"`);
		expect(html).toContain(heading);
		expect(html).toContain(fallback);
	});

	it('renders localized reset and invitation content', () => {
		const reset = renderToStaticMarkup(
			createElement(ResetPasswordEmail, {
				locale: 'es-419',
				url: 'https://example.com/reset',
				user: { email: 'ada@example.com', name: 'Ada' },
			})
		);
		expect(reset).toContain('Restablece tu contraseña');

		const invitation = renderToStaticMarkup(
			createElement(OrganizationInvitationEmail, {
				invitation: { id: 'invite-id', role: 'moderator' },
				inviter: { user: { email: 'grace@example.com', name: 'Grace' } },
				locale: 'zh-Hans',
				organization: { name: 'Kino Labs' },
				siteUrl: 'https://example.com',
			})
		);
		expect(invitation).toContain('接受邀请');
		expect(invitation).toContain('版主');
	});

	it('localizes subjects', () => {
		expect(getEmailCopy('es-419').verification.subject).toBe('Verifica tu correo');
		expect(getEmailCopy('zh-Hans').invitation.subject('Kino Labs')).toBe(
			'在 Kino 上加入 Kino Labs'
		);
	});
});

describe('email request locale resolution', () => {
	it('prefers the explicit locale cookie', () => {
		const request = new Request('https://example.com', {
			headers: { 'accept-language': 'en-US', cookie: 'PARAGLIDE_LOCALE=es-419' },
		});
		expect(resolveRequestLocale(request)).toBe('es-419');
	});

	it('maps supported browser language families and falls back to English', () => {
		expect(
			resolveRequestLocale(
				new Request('https://example.com', { headers: { 'accept-language': 'zh-TW,zh;q=0.9' } })
			)
		).toBe('zh-Hans');
		expect(
			resolveRequestLocale(
				new Request('https://example.com', { headers: { 'accept-language': 'de-DE' } })
			)
		).toBe('en-US');
	});
});
