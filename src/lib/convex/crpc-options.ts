import { api } from '@convex/api';
import { createCRPCOptionsProxy } from 'kitcn/react';

export const crpcOptions = createCRPCOptionsProxy(api, api as never);
