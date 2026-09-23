// Migration-bearing rollback target: keep the Durable Object class while serving
// only the existing Better Auth, Relay, and webhook routes.
export { OAuthState } from './native-state-object';
export { default } from './legacy';
