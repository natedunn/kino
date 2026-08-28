import { extractErrorMessage } from '@/lib/errors';
import * as m from '@/paraglide/messages.js';

const GITHUB_ERROR_MESSAGES: Record<string, () => string> = {
	'Feedback not found': m.github_error_feedback_not_found,
	'GitHub connection state expired': m.github_error_state_expired,
	'GitHub connection state is invalid': m.github_error_state_invalid,
	'GitHub Discussions are not enabled for this repository': m.github_error_discussions_disabled,
	'GitHub installation not found': m.github_error_installation_not_found,
	'GitHub repository connection not found': m.github_error_connection_not_found,
	'GitHub repository is not available to this installation': m.github_error_repository_unavailable,
	'Only organization admins can use this installation': m.github_error_permission,
	'Only organization admins can view GitHub connections': m.github_error_permission,
	'Only project admins and assigned moderators can connect GitHub items': m.github_error_permission,
	'Project not found': m.github_error_project_not_found,
	'This GitHub item is already connected to this feedback': m.github_error_already_connected,
	'This GitHub repository is already connected to another Kino project':
		m.github_error_repository_connected,
};

export function localizeGitHubError(error: unknown): string {
	const message = extractErrorMessage(error, '');
	const localizedMessage = GITHUB_ERROR_MESSAGES[message];
	if (localizedMessage) return localizedMessage();
	if (/^Too many GitHub .+ to refresh safely\. Contact support\.$/.test(message)) {
		return m.github_error_capacity();
	}
	return m.github_error_generic();
}
