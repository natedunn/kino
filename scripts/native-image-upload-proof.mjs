// Bounded hosted proof. Uses the existing disposable native storage identity,
// never a real user account or production deployment.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference as ref } from 'convex/server';
import sharp from 'sharp';

const directory = new URL('../integrations/native-convex/', import.meta.url);
const deploymentKey = parseEnv(
	await readFile(new URL('.env.preview.local', directory), 'utf8')
).CONVEX_DEPLOY_KEY;
assert.ok(deploymentKey?.startsWith('dev:giant-jaguar-319|'));
const { userId } = JSON.parse(await readFile(new URL('.env.storage-proof.local.json', directory)));
assert.ok(typeof userId === 'string');

const client = new ConvexHttpClient('https://giant-jaguar-319.convex.cloud', { logger: false });
client.setAdminAuth(deploymentKey, {
	subject: userId,
	issuer: 'https://giant-jaguar-319.convex.site',
});
const image = await sharp({
	create: { width: 4, height: 4, channels: 3, background: '#4c83df' },
})
	.png()
	.toBuffer();

async function uploadedStorageId(uploadUrl) {
	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: { 'content-type': 'image/png' },
		body: image,
	});
	assert.equal(response.status, 200, 'Convex storage upload must succeed');
	const result = await response.json();
	assert.ok(typeof result.storageId === 'string');
	return result.storageId;
}

const avatar = await client.mutation(ref('profiles:generateAvatarUploadUrl'), {});
const avatarStorageId = await uploadedStorageId(avatar.uploadUrl);
await client.mutation(ref('profiles:registerAvatarUpload'), {
	storageId: avatarStorageId,
	uploadToken: avatar.uploadToken,
});
assert.equal(
	await client.mutation(ref('profiles:discardAvatarUpload'), {
		uploadToken: avatar.uploadToken,
	}),
	true
);
await assert.rejects(
	client.mutation(ref('profiles:commitAvatar'), {
		storageId: avatarStorageId,
		uploadToken: avatar.uploadToken,
	}),
	/INVALID_AVATAR_UPLOAD_INTENT/
);

const organization = await client.query(ref('organizations:personal'), {});
const logo = await client.mutation(ref('organizationAppearance:generateLogoUploadUrl'), {
	organizationId: organization.id,
});
const logoStorageId = await uploadedStorageId(logo.uploadUrl);
await client.mutation(ref('organizationAppearance:registerLogoUpload'), {
	organizationId: organization.id,
	storageId: logoStorageId,
	uploadToken: logo.uploadToken,
});
assert.equal(
	await client.mutation(ref('organizationAppearance:discardLogoUpload'), {
		organizationId: organization.id,
		uploadToken: logo.uploadToken,
	}),
	true
);
await assert.rejects(
	client.mutation(ref('organizationAppearance:commitLogo'), {
		organizationId: organization.id,
		storageId: logoStorageId,
		uploadToken: logo.uploadToken,
	}),
	/INVALID_LOGO_UPLOAD_INTENT/
);

console.log(
	'Hosted native image proof passed: avatar and logo upload, register, discard, replay denial.'
);
