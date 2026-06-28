'use client';

import { useEffect } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/auth/verify-email')({
  head: () => ({ meta: [titleMeta(['Verify email'])] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { error?: string } =>
    typeof search.error === 'string' ? { error: search.error } : {},
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  // Better Auth verifies the token on the API side and redirects here with the
  // outcome. We only render the result.
  const { error } = Route.useSearch();
  const ok = !error;

  useEffect(() => {
    if (ok) trackAuthSuccess('email_verification');
    else trackAuthError('email_verification', error);
  }, [ok, error]);

  return (
    <>
      <AuthHeader title={ok ? 'Email verified' : 'Verification failed'} />
      {ok ? (
        <InlineAlert variant="success">
          Your email address is confirmed. You’re all set.
        </InlineAlert>
      ) : (
        <InlineAlert variant="danger">
          We couldn’t verify your email — the link may have expired. Sign in to
          request a new verification email.
        </InlineAlert>
      )}
      <AuthFooter>
        <Link className="link-text font-medium text-foreground" to="/dashboard">
          Continue to dashboard
        </Link>
      </AuthFooter>
    </>
  );
}
