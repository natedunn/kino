import type { AppLocale } from '../shared/i18n';

type EmailCopy = {
	fallbackLink: string;
	invitation: {
		button: string;
		body: (args: { inviter: string; organization: string; role: string }) => string;
		heading: (organization: string) => string;
		preview: (organization: string) => string;
		someone: string;
		subject: (organization: string) => string;
	};
	reset: {
		body: (name: string) => string;
		button: string;
		heading: string;
		preview: string;
		subject: string;
	};
	roles: Record<'admin' | 'moderator' | 'owner', string>;
	verification: {
		body: (name: string) => string;
		button: string;
		heading: string;
		preview: string;
		subject: string;
	};
};

const COPY: Record<AppLocale, EmailCopy> = {
	'en-US': {
		fallbackLink: 'If the button doesn’t work, copy and paste this link:',
		invitation: {
			button: 'Accept invitation',
			body: ({ inviter, organization, role }) =>
				`${inviter} invited you to join ${organization} on Kino as ${role}.`,
			heading: (organization) => `Join ${organization}`,
			preview: (organization) => `Join ${organization} on Kino`,
			someone: 'Someone',
			subject: (organization) => `Join ${organization} on Kino`,
		},
		reset: {
			body: (name) =>
				`Hi ${name}, we received a request to reset your password. Use the button below to choose a new one. If you didn’t ask for this, you can ignore this email.`,
			button: 'Reset password',
			heading: 'Reset your password',
			preview: 'Reset your password',
			subject: 'Reset your password',
		},
		roles: { admin: 'an admin', moderator: 'a moderator', owner: 'an owner' },
		verification: {
			body: (name) => `Hi ${name}, confirm your email address to finish setting up your account.`,
			button: 'Verify email',
			heading: 'Verify your email',
			preview: 'Verify your email address',
			subject: 'Verify your email',
		},
	},
	'es-419': {
		fallbackLink: 'Si el botón no funciona, copia y pega este enlace:',
		invitation: {
			button: 'Aceptar invitación',
			body: ({ inviter, organization, role }) =>
				`${inviter} te invitó a unirte a ${organization} en Kino como ${role}.`,
			heading: (organization) => `Únete a ${organization}`,
			preview: (organization) => `Únete a ${organization} en Kino`,
			someone: 'Alguien',
			subject: (organization) => `Únete a ${organization} en Kino`,
		},
		reset: {
			body: (name) =>
				`Hola, ${name}. Recibimos una solicitud para restablecer tu contraseña. Usa el botón de abajo para elegir una nueva. Si no hiciste esta solicitud, puedes ignorar este correo.`,
			button: 'Restablecer contraseña',
			heading: 'Restablece tu contraseña',
			preview: 'Restablece tu contraseña',
			subject: 'Restablece tu contraseña',
		},
		roles: { admin: 'administrador', moderator: 'moderador', owner: 'propietario' },
		verification: {
			body: (name) =>
				`Hola, ${name}. Confirma tu dirección de correo para terminar de configurar tu cuenta.`,
			button: 'Verificar correo',
			heading: 'Verifica tu correo',
			preview: 'Verifica tu dirección de correo',
			subject: 'Verifica tu correo',
		},
	},
	'zh-Hans': {
		fallbackLink: '如果按钮无法使用，请复制并粘贴此链接：',
		invitation: {
			button: '接受邀请',
			body: ({ inviter, organization, role }) =>
				`${inviter} 邀请你以${role}身份加入 Kino 上的 ${organization}。`,
			heading: (organization) => `加入 ${organization}`,
			preview: (organization) => `在 Kino 上加入 ${organization}`,
			someone: '有人',
			subject: (organization) => `在 Kino 上加入 ${organization}`,
		},
		reset: {
			body: (name) =>
				`${name}，你好。我们收到了重置你密码的请求。请使用下方按钮设置新密码。如果这不是你的操作，可以忽略此邮件。`,
			button: '重置密码',
			heading: '重置密码',
			preview: '重置你的密码',
			subject: '重置你的密码',
		},
		roles: { admin: '管理员', moderator: '版主', owner: '所有者' },
		verification: {
			body: (name) => `${name}，你好。请确认你的电子邮件地址以完成帐户设置。`,
			button: '验证电子邮件',
			heading: '验证电子邮件',
			preview: '验证你的电子邮件地址',
			subject: '验证你的电子邮件',
		},
	},
};

export function getEmailCopy(locale: AppLocale) {
	return COPY[locale];
}
