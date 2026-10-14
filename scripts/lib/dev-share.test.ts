import { describe, expect, it } from 'vitest';

import {
	appendTunnelOutput,
	isOwnedShareCommand,
	mergeFrontendEnv,
	quickTunnelUrlFromOutput,
	shouldRegisterLocalGatewayRoute,
} from './dev-share.mjs';

describe('Quick Tunnel development helpers', () => {
	it('extracts a URL when Wrangler output arrives in chunks', () => {
		let output = appendTunnelOutput('', 'INF Requesting new quick Tunnel on trycloudflare');
		expect(quickTunnelUrlFromOutput(output)).toBeNull();
		output = appendTunnelOutput(output, '\nINF +https://quiet-bird-123.trycloud');
		expect(quickTunnelUrlFromOutput(output)).toBeNull();
		output = appendTunnelOutput(output, 'flare.com ready');
		expect(quickTunnelUrlFromOutput(output)).toBe('https://quiet-bird-123.trycloudflare.com');
	});

	it('rejects deceptive and malformed tunnel URLs', () => {
		expect(quickTunnelUrlFromOutput('https://quiet.trycloudflare.com.evil.test')).toBeNull();
		expect(quickTunnelUrlFromOutput('https://quiet.trycloudflare.com:8443')).toBeNull();
		expect(quickTunnelUrlFromOutput('https://quiet.trycloudflare.com@evil.test')).toBeNull();
		expect(quickTunnelUrlFromOutput('http://quiet.trycloudflare.com')).toBeNull();
		expect(quickTunnelUrlFromOutput('no URL here')).toBeNull();
	});

	it('lets runtime share URLs override local environment values', () => {
		const result = mergeFrontendEnv(
			{
				KINO_SHARE: '1',
				VITE_CONVEX_URL: 'https://cloud.trycloudflare.com',
				VITE_SITE_URL: 'https://app.trycloudflare.com',
			},
			{
				VITE_CONVEX_URL: 'http://127.0.0.1:3001',
				VITE_SITE_URL: 'http://localhost:3000',
			}
		);
		expect(result.VITE_CONVEX_URL).toBe('https://cloud.trycloudflare.com');
		expect(result.VITE_SITE_URL).toBe('https://app.trycloudflare.com');
	});

	it('turns GitHub login off for share sessions without changing local dev', () => {
		const local = { VITE_NATIVE_GITHUB_ENABLED: 'true', NATIVE_GITHUB_ROUTE_ID: 'local-abc' };
		expect(mergeFrontendEnv({}, local).VITE_NATIVE_GITHUB_ENABLED).toBe('true');
		const shared = mergeFrontendEnv({ KINO_SHARE: '1' }, local);
		expect(shared.VITE_NATIVE_GITHUB_ENABLED).toBe('false');
		expect(local.VITE_NATIVE_GITHUB_ENABLED).toBe('true');
	});

	it('registers the local gateway route only outside share mode', () => {
		expect(shouldRegisterLocalGatewayRoute({})).toBe(true);
		expect(shouldRegisterLocalGatewayRoute({ KINO_SHARE: '0' })).toBe(true);
		expect(shouldRegisterLocalGatewayRoute({ KINO_SHARE: '1' })).toBe(false);
	});

	it('recognizes only worktree-owned share commands', () => {
		const root = '/worktrees/kino-a';
		expect(
			isOwnedShareCommand(
				'pnpm --dir /worktrees/kino-a exec wrangler tunnel quick-start http://127.0.0.1:4000',
				root
			)
		).toBe(true);
		expect(isOwnedShareCommand('node /worktrees/kino-a/scripts/dev-supervisor.mjs', root)).toBe(
			true
		);
		expect(
			isOwnedShareCommand(
				'pnpm --dir /worktrees/kino-b exec wrangler tunnel quick-start http://127.0.0.1:4000',
				root
			)
		).toBe(false);
	});

	it('pins share command ownership to the exact worktree root', () => {
		const root = '/worktrees/kino-a';
		for (const other of ['/worktrees/kino-a-2', '/worktrees/kino-a/.claude/worktrees/x']) {
			expect(
				isOwnedShareCommand(
					`pnpm --dir ${other} exec wrangler tunnel quick-start http://127.0.0.1:4000`,
					root
				)
			).toBe(false);
			expect(isOwnedShareCommand(`node ${other}/scripts/dev-supervisor.mjs`, root)).toBe(false);
		}
	});
});
