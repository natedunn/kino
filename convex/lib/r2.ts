import { R2 } from '@convex-dev/r2';
import { components } from '../functions/_generated/api';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const userUploadsR2 = new R2(components.r2, {
  R2_ACCESS_KEY_ID: env.R2_USER_UPLOADS_ACCESS_KEY_ID,
  R2_BUCKET: env.R2_USER_UPLOADS_BUCKET,
  R2_ENDPOINT: env.R2_USER_UPLOADS_ENDPOINT,
  R2_SECRET_ACCESS_KEY: env.R2_USER_UPLOADS_SECRET_ACCESS_KEY,
});

export const orgUploadsR2 = new R2(components.r2, {
  R2_ACCESS_KEY_ID: env.R2_ORG_UPLOADS_ACCESS_KEY_ID,
  R2_BUCKET: env.R2_ORG_UPLOADS_BUCKET,
  R2_ENDPOINT: env.R2_ORG_UPLOADS_ENDPOINT,
  R2_SECRET_ACCESS_KEY: env.R2_ORG_UPLOADS_SECRET_ACCESS_KEY,
});
