import { createAuthClient } from 'better-auth/react';
import {
  organizationClient,
  usernameClient,
} from 'better-auth/client/plugins';
import { convexClient } from 'kitcn/auth/client';
import { createAuthMutations } from 'kitcn/react';
import { ac, roles } from '@convex/auth-roles';

export const authClient = createAuthClient({
  baseURL:
    typeof window === 'undefined'
      ? (import.meta.env.VITE_SITE_URL as string | undefined)
      : window.location.origin,
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
  plugins: [
    usernameClient(),
    organizationClient({ ac, roles }),
    convexClient(),
  ],
});

export const {
  useSignOutMutationOptions,
} = createAuthMutations(authClient);
