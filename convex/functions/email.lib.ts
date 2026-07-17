import { z } from 'zod';

export const recipientsSchema = z.union([z.string().email(), z.array(z.string().email()).min(1)]);
