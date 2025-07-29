import { httpRouter } from 'convex/server';

import { createAuth } from '@/lib/auth';

import { betterAuthComponent } from './api/auth';

const http = httpRouter();

betterAuthComponent.registerRoutes(http, createAuth);

export default http;
