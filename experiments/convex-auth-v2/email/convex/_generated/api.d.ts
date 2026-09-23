/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as auth from '../auth.js';
import type * as github from '../github.js';
import type * as invitationFixtures from '../invitationFixtures.js';
import type * as invitationMail from '../invitationMail.js';
import type * as invitations from '../invitations.js';
import type * as mail from '../mail.js';
import type * as organizations from '../organizations.js';
import type * as policy from '../policy.js';
import type * as proof from '../proof.js';
import type * as users from '../users.js';

declare const fullApi: ApiFromModules<{
	auth: typeof auth;
	github: typeof github;
	invitationFixtures: typeof invitationFixtures;
	invitationMail: typeof invitationMail;
	invitations: typeof invitations;
	mail: typeof mail;
	organizations: typeof organizations;
	policy: typeof policy;
	proof: typeof proof;
	users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;

export declare const components: {
	auth: import('../../../.revocation/packages/core/src/components/core/_generated/component.js').ComponentApi<'auth'>;
	password: import('../../../.revocation/packages/core/src/components/password/_generated/component.js').ComponentApi<'password'>;
	emailLimits: import('@convex-dev/rate-limiter/_generated/component.js').ComponentApi<'emailLimits'>;
	oauthGithub: import('../../../.revocation/packages/core/src/oauth/component/_generated/component.js').ComponentApi<'oauthGithub'>;
};
