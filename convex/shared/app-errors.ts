export const APP_ERROR_CODES = [
	'AUTH_REQUIRED',
	'PROFILE_NOT_FOUND',
	'USER_NOT_FOUND',
	'ORGANIZATION_NOT_FOUND',
	'PROJECT_NOT_FOUND',
	'PROJECT_ARCHIVED',
	'PERMISSION_DENIED',
	'PROJECT_ARCHIVE_ADMIN_ONLY',
	'ORGANIZATION_LIMIT_REACHED',
	'PROJECT_LIMIT_REACHED',
	'PROJECT_SLUG_TAKEN',
	'USERNAME_TAKEN',
	'ACCOUNT_NOT_FOUND_FOR_EMAIL',
	'ACCOUNT_NOT_READY',
	'PROJECT_MEMBER_ALREADY_HAS_ACCESS',
	'PROJECT_MEMBER_ORG_MANAGED',
	'FILE_UPLOAD_BATCH_TOO_LARGE',
	'FOLDER_LIMIT_REACHED',
	'FOLDER_DEPTH_EXCEEDED',
	'FOLDER_NAME_TAKEN',
	'FOLDER_NOT_EMPTY',
	'FILE_IN_USE',
	'INVALID_IMAGE_FORMAT',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];
export type AppErrorValues = Record<string, string | number>;

export function isAppErrorCode(value: unknown): value is AppErrorCode {
	return typeof value === 'string' && (APP_ERROR_CODES as readonly string[]).includes(value);
}

export function parseAppErrorValues(value: unknown): AppErrorValues {
	if (typeof value !== 'string') return {};
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed).filter(
				(entry): entry is [string, string | number] =>
					typeof entry[1] === 'string' || typeof entry[1] === 'number'
			)
		);
	} catch {
		return {};
	}
}
