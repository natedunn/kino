import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const directory = new URL('../.convex/', import.meta.url);
const destination = new URL('native-auth.env.local', directory);
await mkdir(directory, { recursive: true });
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const settings = {
	AUTH_PRIVATE_KEY: Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString(
		'base64'
	),
	AUTH_JWKS: JSON.stringify({
		keys: [
			{
				...publicKey.export({ format: 'jwk' }),
				kid: 'kino-native-local',
				alg: 'RS256',
				use: 'sig',
			},
		],
	}),
	AUTH_APP_ORIGIN: 'http://127.0.0.1:5190',
	AUTH_GITHUB_CLIENT_ID: 'local-not-configured',
	AUTH_GITHUB_CLIENT_SECRET: 'local-not-configured',
	AUTH_GITHUB_CALLBACK_URL: 'http://127.0.0.1:4441/oauth/github/callback',
};
try {
	await writeFile(
		destination,
		Object.entries(settings)
			.map(([name, value]) => `${name}='${value}'`)
			.join('\n') + '\n',
		{ mode: 0o600, flag: 'wx' }
	);
	console.log(
		'Created ignored local auth configuration with a fresh signing key. GitHub credentials remain unconfigured.'
	);
} catch (error) {
	if (error.code !== 'EEXIST') throw error;
	console.log('Kept existing local auth configuration and signing key.');
}
