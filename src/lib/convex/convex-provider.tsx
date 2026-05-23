'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ConvexAuthProvider } from 'kitcn/auth/client';
import {
  ConvexReactClient,
  getConvexQueryClientSingleton,
  useAuthStore,
} from 'kitcn/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { authClient } from '@/lib/convex/auth-client';
import { CRPCProvider } from '@/lib/convex/crpc';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);

export function AppConvexProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexAuthProvider authClient={authClient} client={convex}>
      <QueryProvider>{children}</QueryProvider>
    </ConvexAuthProvider>
  );
}

function QueryProvider({ children }: { children: ReactNode }) {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();
  const convexQueryClient = getConvexQueryClientSingleton({
    authStore,
    convex,
    queryClient,
  });

  return (
    <CRPCProvider convexClient={convex} convexQueryClient={convexQueryClient}>
      <ConvexTokenBootstrap />
      {children}
    </CRPCProvider>
  );
}

function decodeJwtExp(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(padded)) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function ConvexTokenBootstrap() {
  const authStore = useAuthStore();
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.data?.session || authStore.get('token')) return;

    let cancelled = false;

    authClient.convex
      .token({ fetchOptions: { throw: false } })
      .then((result) => {
        const token = result.data?.token ?? null;
        if (cancelled || !token) return;

        authStore.set('token', token);
        authStore.set('expiresAt', decodeJwtExp(token));
        authStore.set('isAuthenticated', true);
        authStore.set('sessionSyncGraceUntil', null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [authStore, session.data?.session]);

  return null;
}
