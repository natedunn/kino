'use client';

import { ChevronLeft } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from 'kitcn/react';

import { Button } from '@/components/ui/button';
import { authClient, useSignOutMutationOptions } from '@/lib/convex/auth-client';

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});

export function getSafeRedirectTarget(redirect: string | undefined) {
  if (!redirect) {
    return '/';
  }

  try {
    const resolved = new URL(redirect, 'https://usekino.com');
    return resolved.pathname === '/auth' ? '/' : `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
}

function AuthPage() {
  const search = Route.useSearch() as { redirect?: string };
  const { hasSession, isLoading } = useAuth();
  const session = authClient.useSession();
  const signOut = useMutation(useSignOutMutationOptions());

  if (isLoading) {
    return null;
  }

  if (hasSession && session.data?.user) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Signed in</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {session.data.user.name || session.data.user.email}
          </h1>
          <p className="text-sm text-muted-foreground">{session.data.user.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
            type="button"
          >
            {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </Button>
          <Link
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            to="/profile/settings"
          >
            Profile settings
          </Link>
        </div>
      </main>
    );
  }

  if (hasSession) {
    return null;
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 md:p-8">
        <div className="flex flex-col gap-4">
          <Button
            onClick={async () => {
              const callbackURL = new URL(
                getSafeRedirectTarget(search.redirect),
                window.location.origin,
              ).toString();

              await authClient.signIn.social({
                callbackURL,
                provider: 'github',
              });
            }}
            type="button"
          >
            Sign in with GitHub
          </Button>
          <div>
            <div className="mb-4 h-px bg-border" />
            <Link
              className="flex items-center gap-2 text-sm text-muted-foreground decoration-foreground/50 decoration-2 underline-offset-2 hover:underline"
              to="/"
            >
              <ChevronLeft size={14} />
              <span>Or go back</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
