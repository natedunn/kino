#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
	anonymousConvexEnv,
	anonymousEnvFilePath,
	ensureAnonymousEnvFile,
	ensureWorktreeLocalBackendPorts,
	preserveSharedDevDeployment,
	projectLocalConfigPath,
	readEnvFile,
	stopLocalBackendForWorkspace,
	waitForLocalBackendToStart,
} from './lib/local-convex.mjs';

const workspaceRoot = process.cwd();
const reset = process.argv.includes('--reset-local-state');
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--reset-local-state');

if (unknownArgs.length > 0) {
	console.error(`Unknown option(s): ${unknownArgs.join(', ')}`);
	console.error('Usage: node scripts/init-native-local.mjs [--reset-local-state]');
	process.exit(1);
}

function run(command, args, env) {
	console.log(`[native-local] ${command} ${args.join(' ')}`);
	const result = spawnSync(command, args, {
		cwd: workspaceRoot,
		env,
		stdio: 'inherit',
	});
	if (result.status !== 0) process.exit(result.status ?? 1);
}

function quoteEnvValue(value) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function waitForReady(logPath, child, timeoutMs = 120_000) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (child.exitCode !== null || child.signalCode !== null) return false;
		if (fs.existsSync(logPath)) {
			const output = fs.readFileSync(logPath, 'utf8');
			if (/Convex functions ready!|Convex ready/i.test(output)) return true;
		}
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
	}
	return false;
}

function stopChild(child) {
	if (!child.pid) return;
	try {
		if (process.platform === 'win32') child.kill('SIGTERM');
		else process.kill(-child.pid, 'SIGTERM');
	} catch {
		child.kill('SIGTERM');
	}
}

preserveSharedDevDeployment(workspaceRoot, 'scripts/init-native-local.mjs');
ensureAnonymousEnvFile(workspaceRoot);
stopLocalBackendForWorkspace(workspaceRoot, {
	logPrefix: '[native-local]',
	failOnStubborn: true,
});

const configPath = projectLocalConfigPath(workspaceRoot);
if (reset && fs.existsSync(configPath)) {
	fs.rmSync(path.dirname(path.dirname(configPath)), {
		recursive: true,
		force: true,
	});
	console.log('[native-local] removed the previous local deployment state');
}

const convexEnv = anonymousConvexEnv();
run('pnpm', ['exec', 'convex', 'init'], convexEnv);

const ports = ensureWorktreeLocalBackendPorts(workspaceRoot);
if (!ports) {
	console.error('[native-local] Convex did not create a local deployment config');
	process.exit(1);
}
console.log(`[native-local] using worktree-local Convex ports ${ports.cloud}/${ports.site}`);

const authEnvPath = path.join(workspaceRoot, '.convex', 'native-auth.env.local');
if (!fs.existsSync(authEnvPath)) {
	run('node', ['scripts/prepare-native-auth-local.mjs'], process.env);
}

const authEnv = readEnvFile(authEnvPath);
const portlessName = spawnSync('sh', ['scripts/portless-name.sh', 'kino'], {
	cwd: workspaceRoot,
	encoding: 'utf8',
}).stdout.trim();
const appOrigin =
	process.env.VITE_SITE_URL ??
	process.env.PORTLESS_URL ??
	`https://${portlessName}.localhost:${process.env.PORTLESS_PORT ?? '1355'}`;
authEnv.AUTH_APP_ORIGIN = new URL(appOrigin).origin;
authEnv.AUTH_GITHUB_CALLBACK_URL = `http://127.0.0.1:${ports.site}/oauth/github/callback`;

const temporaryEnvPath = path.join(os.tmpdir(), `kino-native-local-${process.pid}.env`);
fs.writeFileSync(
	temporaryEnvPath,
	`${Object.entries(authEnv)
		.map(([name, value]) => `${name}=${quoteEnvValue(value)}`)
		.join('\n')}\n`,
	{ mode: 0o600 }
);

const logDir = path.join(os.tmpdir(), 'kino-dev', path.basename(workspaceRoot));
fs.mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, 'native-local-init.log');
const logFd = fs.openSync(logPath, 'w');
const child = spawn(
	path.join(
		workspaceRoot,
		'node_modules',
		'.bin',
		process.platform === 'win32' ? 'convex.cmd' : 'convex'
	),
	[
		'dev',
		'--until-success',
		'--env-file',
		path.relative(workspaceRoot, anonymousEnvFilePath(workspaceRoot)),
	],
	{
		cwd: workspaceRoot,
		detached: process.platform !== 'win32',
		env: convexEnv,
		stdio: ['ignore', logFd, logFd],
	}
);
fs.closeSync(logFd);

try {
	if (!waitForLocalBackendToStart(ports.cloud, 30_000, workspaceRoot)) {
		throw new Error(`local backend did not listen on port ${ports.cloud}`);
	}
	run(
		'pnpm',
		['exec', 'convex', 'env', 'set', '--from-file', temporaryEnvPath, '--force'],
		convexEnv
	);
	if (!waitForReady(logPath, child)) {
		throw new Error(`native functions did not become ready; see ${logPath}`);
	}
	console.log('[native-local] native Convex functions are ready');
} finally {
	fs.rmSync(temporaryEnvPath, { force: true });
	stopChild(child);
	stopLocalBackendForWorkspace(workspaceRoot, { logPrefix: '[native-local]' });
}
