import crypto from 'node:crypto';

import { symmetricEncrypt } from 'better-auth/crypto';
import { generateExportedKeyPair } from 'better-auth/plugins';

import { parseEnvValue } from './local-convex.mjs';

function parseEnvContents(contents) {
	const env = {};
	for (const line of contents.split(/\r?\n/)) {
		const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) continue;
		env[match[1]] = parseEnvValue(match[2]);
	}
	return env;
}

function withoutEnvVariables(contents, names) {
	const blocked = new Set(names);
	const lines = contents.split(/\r?\n/).filter((line) => {
		const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/);
		return !match || !blocked.has(match[1]);
	});

	while (lines.at(-1) === '') lines.pop();
	return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function envFileContents(values) {
	return `${Object.entries(values)
		.map(([name, value]) => {
			if (value.includes("'")) {
				throw new Error(`[seed] cannot safely serialize ${name} to an env file`);
			}
			return `${name}='${value}'`;
		})
		.join('\n')}\n`;
}

function isValidJwks(value) {
	if (!value) return false;
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) && parsed.length > 0;
	} catch {
		return false;
	}
}

export async function generateLocalJwks(
	betterAuthSecret,
	{
		encrypt = symmetricEncrypt,
		generateKeyPair = generateExportedKeyPair,
		now = Date.now,
		randomUUID = crypto.randomUUID,
	} = {}
) {
	const { alg, privateWebKey, publicWebKey } = await generateKeyPair({
		jwks: { keyPairConfig: { alg: 'RS256' } },
	});
	const encryptedPrivateKey = await encrypt({
		data: JSON.stringify(privateWebKey),
		key: betterAuthSecret,
	});

	return JSON.stringify([
		{
			alg,
			createdAt: now(),
			id: randomUUID(),
			privateKey: JSON.stringify(encryptedPrivateKey),
			publicKey: JSON.stringify(publicWebKey),
		},
	]);
}

export async function planAnonymousAuthEnv({
	generateJwks = generateLocalJwks,
	randomSecret = () => crypto.randomBytes(32).toString('hex'),
	sourceEnvContents = '',
	targetEnvContents = '',
}) {
	const sourceEnv = parseEnvContents(sourceEnvContents);
	const targetEnv = parseEnvContents(targetEnvContents);
	const copiedEnvContents = withoutEnvVariables(sourceEnvContents, ['JWKS']);

	const betterAuthSecret =
		sourceEnv.BETTER_AUTH_SECRET ?? targetEnv.BETTER_AUTH_SECRET ?? randomSecret();
	const canPreserveJwks =
		isValidJwks(targetEnv.JWKS) && targetEnv.BETTER_AUTH_SECRET === betterAuthSecret;

	if (canPreserveJwks) {
		return {
			authEnvContents: '',
			copiedEnvContents,
			generatedJwks: false,
		};
	}

	const authEnv = {
		JWKS: await generateJwks(betterAuthSecret),
	};
	if (!sourceEnv.BETTER_AUTH_SECRET && !targetEnv.BETTER_AUTH_SECRET) {
		authEnv.BETTER_AUTH_SECRET = betterAuthSecret;
	}

	return {
		authEnvContents: envFileContents(authEnv),
		copiedEnvContents,
		generatedJwks: true,
	};
}
