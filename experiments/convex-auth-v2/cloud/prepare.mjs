// Derive an isolated GitHub-only cloud fixture from the tested local backend.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const target = process.env.PROOF_TARGET === 'beta' ? 'cloud-beta' : 'cloud';
const origin =
	process.env.PROOF_TARGET === 'beta'
		? 'https://kino-auth-v2-proof-beta-c318c09d.hello-fc8.workers.dev'
		: 'https://kino-auth-v2-proof-c318c09d.hello-fc8.workers.dev';
cpSync(new URL('email/convex', root), new URL(`${target}/convex`, root), { recursive: true });
const path = new URL(`${target}/convex/github.ts`, root);
writeFileSync(
	path,
	readFileSync(path, 'utf8').replace("['https://127.0.0.1:5183']", `['${origin}']`)
);
// Cloud proof sends no emails and carries no Bento credentials.
writeFileSync(
	new URL(`${target}/convex/mail.ts`, root),
	`import {v} from 'convex/values';
import {internalAction} from './_generated/server';
export const deliver = internalAction({args:{email:v.string(),purpose:v.union(v.literal('verify'),v.literal('reset')),code:v.string()},returns:v.null(),handler:async()=>{throw new Error('Email delivery is disabled in the GitHub cloud proof');}});
`
);
console.log('Prepared isolated cloud source; local backend unchanged.');
// Internal-only seed endpoints are confined to the disposable cloud fixture.
cpSync(new URL('cloud/fixtures.ts.template', root), new URL(`${target}/convex/fixtures.ts`, root));

// Invitation delivery is enabled only in the alpha proof, with an exact origin.
const invitationMail = new URL(`${target}/convex/invitationMail.ts`, root);
writeFileSync(
	invitationMail,
	readFileSync(invitationMail, 'utf8').replace("'http://127.0.0.1:5181'", JSON.stringify(origin))
);
// Same admin-only fixture, guarded against accidentally seeding a different backend.
const invitationFixtures = new URL(`${target}/convex/invitationFixtures.ts`, root);
const site =
	process.env.PROOF_TARGET === 'beta'
		? 'https://cautious-oriole-896.convex.site'
		: 'https://graceful-elephant-103.convex.site';
writeFileSync(
	invitationFixtures,
	readFileSync(invitationFixtures, 'utf8').replaceAll("'http://127.0.0.1:4421'", JSON.stringify(site))
);
