import { createAuthClient } from 'better-auth/react';
import {
  adminClient,
  organizationClient,
  usernameClient,
} from 'better-auth/client/plugins';
import { convexClient } from 'kitcn/auth/client';
import { createAuthMutations } from 'kitcn/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window === 'undefined'
      ? (import.meta.env.VITE_SITE_URL as string | undefined)
      : window.location.origin,
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
  plugins: [usernameClient(), adminClient(), organizationClient(), convexClient()],
});

export const {
  useSignOutMutationOptions,
} = createAuthMutations(authClient);
