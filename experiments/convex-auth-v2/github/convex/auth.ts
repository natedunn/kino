import { setupCore } from '../../.upstream/packages/core/src/components/core/setup.ts';
import { setupGithub } from '../../.upstream/packages/core/src/oauth/component/github.ts';
import { components, internal } from './_generated/api';

const core = setupCore({ component: components.auth });
export const { signOut, refreshSession, isAuthenticated } = core;

export const { startSignInGithub, completeSignInGithub } = setupGithub(core, {
	component: components.oauthGithub,
	allowedRedirectOrigins: ['http://127.0.0.1:5179'],
}).attachUserCallbacks({ createUser: internal.users.createUser });
