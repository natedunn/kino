import { capturePostHogEvent } from '@/lib/posthog';

/**
 * PostHog tracking for auth operations. Every operation emits a success or
 * failure event (and, for redirect-based flows like OAuth where completion
 * can't be observed on this page, a "started" event). No PII is sent — only the
 * operation, method, and an error reason/code.
 *
 * Events: `auth_<operation>_started | _succeeded | _failed`.
 */
export type AuthOperation =
  | 'sign_in'
  | 'sign_up'
  | 'sign_out'
  | 'password_reset_request'
  | 'password_reset'
  | 'email_verification'
  | 'invitation_accept';

export function trackAuthStarted(
  operation: AuthOperation,
  properties?: Record<string, unknown>,
) {
  capturePostHogEvent(`auth_${operation}_started`, properties);
}

export function trackAuthSuccess(
  operation: AuthOperation,
  properties?: Record<string, unknown>,
) {
  capturePostHogEvent(`auth_${operation}_succeeded`, properties);
}

// Normalizes a thrown Error or a Better Auth `{ error }` object into a compact,
// non-PII reason/code/status.
function describeError(input: unknown): Record<string, unknown> {
  if (input instanceof Error) return { reason: input.message };
  if (input && typeof input === 'object') {
    const o = input as {
      message?: unknown;
      statusText?: unknown;
      code?: unknown;
      status?: unknown;
    };
    return {
      reason:
        typeof o.message === 'string'
          ? o.message
          : typeof o.statusText === 'string'
            ? o.statusText
            : 'unknown',
      ...(typeof o.code === 'string' ? { code: o.code } : {}),
      ...(typeof o.status === 'number' ? { status: o.status } : {}),
    };
  }
  return { reason: typeof input === 'string' ? input : 'unknown' };
}

export function trackAuthError(
  operation: AuthOperation,
  error: unknown,
  properties?: Record<string, unknown>,
) {
  capturePostHogEvent(`auth_${operation}_failed`, {
    ...describeError(error),
    ...properties,
  });
}
