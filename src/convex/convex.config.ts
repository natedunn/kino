import r2 from '@convex-dev/r2/convex.config';
import { defineApp } from 'convex/server';

import betterAuth from './betterAuth/convex.config';

const app = defineApp();
app.use(betterAuth);
app.use(r2);

export default app;
