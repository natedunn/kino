'use client';

import { useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';

import { AuthFooter, AuthHeader } from '@/components/auth/auth-card';
import { InlineAlert } from '@/components/inline-alert';
import { Button } from '@/components/ui/button';
import { trackAuthError, trackAuthSuccess } from '@/lib/auth-analytics';
import { authClient } from '@/lib/convex/auth-client';
import { titleMeta } from '@/lib/seo';

export const Route = createFileRoute('/auth/accept-invitation')({
  head: () => ({ meta: [titleMeta(['Accept invitation'])] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { invitationId?: string } =>
    typeof search.invitationId === 'string'
      ? { invitationId: search.invitationId }
      : {},
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { invitationId } = Route.useSearch();
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  if (!invitationId) {
    return (
      <>
        <AuthHeader title="Invalid invitation" />
        <InlineAlert variant="danger">This invitation link is missing or malformed.</InlineAlert>
      </>
    );
  }

  // Accepting requires an authenticated account. Send the user to sign in and
  // back here.
  if (!session.isPending && !session.data?.user) {
    const back = `/auth/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
    return (
      <>
        <AuthHeader
          title="Accept your invitation"
          description="Sign in or create an account to join this organization."
        />
        <InlineAlert variant="info">
          You were invited to an organization on Kino. Sign in with the email the
          invite was sent to.
        </InlineAlert>
        <AuthFooter>
          <Link
            className="link-text font-medium text-foreground"
            to="/auth"
            search={{ redirect: back }}
          >
            Continue to sign in
          </Link>
        </AuthFooter>
      </>
    );
  }

  async function onAccept() {
    setError(null);
    setPending(true);
    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId: invitationId!,
      });
      if (res.error) {
        trackAuthError('invitation_accept', res.error);
        setError(res.error.message ?? 'Could not accept the invitation.');
      } else {
        trackAuthSuccess('invitation_accept');
        setAccepted(true);
        setTimeout(() => navigate({ to: '/dashboard' }), 1200);
      }
    } catch (err) {
      trackAuthError('invitation_accept', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <AuthHeader
        title="Accept your invitation"
        description="Join this organization on Kino."
      />
      {accepted ? (
        <InlineAlert variant="success">
          You’ve joined the organization. Redirecting…
        </InlineAlert>
      ) : (
        <div className="flex flex-col gap-4">
          {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
          <Button disabled={pending} onClick={onAccept} size="lg" type="button">
            {pending ? 'Joining…' : 'Accept invitation'}
          </Button>
        </div>
      )}
      <AuthFooter>
        <Link className="link-text font-medium text-foreground" to="/dashboard">
          Go to dashboard
        </Link>
      </AuthFooter>
    </>
  );
}
