import { R2 } from '@convex-dev/r2';

import { components } from '../../_generated/api';

export const userUploadsR2 = new R2(components.r2, {
	R2_ACCESS_KEY_ID: process.env.R2_USER_UPLOADS_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY: process.env.R2_USER_UPLOADS_SECRET_ACCESS_KEY,
	R2_BUCKET: process.env.R2_USER_UPLOADS_BUCKET,
	R2_ENDPOINT: process.env.R2_USER_UPLOADS_ENDPOINT,
});
