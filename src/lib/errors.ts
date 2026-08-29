import { isAppErrorCode, parseAppErrorValues } from '@convex/app-errors';

import * as m from '@/paraglide/messages.js';

// Convex wraps a thrown server error into a single string like:
//   "[CONVEX M(project:update)] [Request ID: ...] Server Error\n
//    Uncaught CRPCError: <the real message> at <anonymous> (../../convex/...) at async ..."
// Surfacing that verbatim to users leaks the stack trace and request framing.
// `extractErrorMessage` pulls out just the human-readable message.
export function extractErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
	if (!error) return fallback;

	const anyError = error as { data?: { message?: string }; message?: string };

	// kitcn/CRPC surfaces a structured message on `.data` when available — prefer it.
	if (anyError.data?.message) return anyError.data.message;

	const raw = anyError.message ?? '';
	if (!raw) return fallback;

	// Strip the Convex framing: grab the text after "Uncaught <Name>Error:" and
	// before the first stack frame (" at <anonymous>" / " at async ...").
	const match = raw.match(/Uncaught \w*Error:\s*([\s\S]*?)\s+at\s+(?:<anonymous>|async\b)/);
	if (match?.[1]) return match[1].trim();

	return raw;
}

type StructuredErrorData = {
	appErrorCode?: unknown;
	appErrorValues?: unknown;
	code?: unknown;
	message?: string;
};

function translateAppError(code: unknown, values: unknown): string | undefined {
	if (!isAppErrorCode(code)) return undefined;
	const parsed = parseAppErrorValues(values);

	switch (code) {
		case 'AUTH_REQUIRED':
			return m.server_error_auth_required();
		case 'PROFILE_NOT_FOUND':
			return m.server_error_profile_not_found();
		case 'USER_NOT_FOUND':
			return m.server_error_user_not_found();
		case 'ORGANIZATION_NOT_FOUND':
			return m.server_error_organization_not_found();
		case 'PROJECT_NOT_FOUND':
			return m.server_error_project_not_found();
		case 'PROJECT_ARCHIVED':
			return m.server_error_project_archived();
		case 'PERMISSION_DENIED':
			return m.server_error_permission_denied();
		case 'PROJECT_ARCHIVE_ADMIN_ONLY':
			return m.server_error_project_archive_admin_only();
		case 'ORGANIZATION_LIMIT_REACHED':
			return m.server_error_organization_limit_reached();
		case 'PROJECT_LIMIT_REACHED':
			return m.server_error_project_limit_reached();
		case 'PROJECT_SLUG_TAKEN':
			return m.server_error_project_slug_taken({ slug: String(parsed.slug ?? '') });
		case 'USERNAME_TAKEN':
			return m.server_error_username_taken();
		case 'ACCOUNT_NOT_FOUND_FOR_EMAIL':
			return m.server_error_account_not_found_for_email();
		case 'ACCOUNT_NOT_READY':
			return m.server_error_account_not_ready();
		case 'PROJECT_MEMBER_ALREADY_HAS_ACCESS':
			return m.server_error_project_member_already_has_access();
		case 'PROJECT_MEMBER_ORG_MANAGED':
			return m.server_error_project_member_org_managed();
		case 'FILE_UPLOAD_BATCH_TOO_LARGE':
			return m.server_error_file_upload_batch_too_large();
		case 'FOLDER_LIMIT_REACHED':
			return m.server_error_folder_limit_reached();
		case 'FOLDER_DEPTH_EXCEEDED':
			return m.server_error_folder_depth_exceeded({ count: String(parsed.count ?? '') });
		case 'FOLDER_NAME_TAKEN':
			return m.server_error_folder_name_taken();
		case 'FOLDER_NOT_EMPTY':
			return m.server_error_folder_not_empty();
		case 'FILE_IN_USE':
			return m.server_error_file_in_use();
		case 'INVALID_IMAGE_FORMAT':
			return m.server_error_invalid_image_format();
	}
}

function translateCategory(code: unknown): string | undefined {
	switch (code) {
		case 'UNAUTHORIZED':
			return m.server_error_auth_required();
		case 'FORBIDDEN':
			return m.server_error_permission_denied();
		case 'NOT_FOUND':
			return m.server_error_not_found();
		case 'CONFLICT':
			return m.server_error_conflict();
		case 'BAD_REQUEST':
		case 'UNPROCESSABLE_CONTENT':
			return m.server_error_invalid_request();
		case 'TOO_MANY_REQUESTS':
			return m.server_error_rate_limited();
		case 'INTERNAL_SERVER_ERROR':
			return m.common_something_went_wrong();
		default:
			return undefined;
	}
}

/** Converts structured server failures into locale-aware, user-safe copy. */
export function localizeError(
	error: unknown,
	fallback: string = m.common_something_went_wrong()
): string {
	if (!error) return fallback;
	const anyError = error as { data?: StructuredErrorData; message?: string };
	const data = anyError.data;
	const domainMessage = translateAppError(data?.appErrorCode, data?.appErrorValues);
	if (domainMessage) return domainMessage;
	const categoryMessage = translateCategory(data?.code);
	if (categoryMessage) return categoryMessage;

	// Preserve explicit client-side errors (for example, a localized upload error),
	// but never expose Convex's server framing when an older deployment lacks codes.
	if (anyError.message && !anyError.message.includes('[CONVEX ')) return anyError.message;
	return fallback;
}
