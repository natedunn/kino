import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../../convex/native/_generated/api';

export type ProjectOverviewData = NonNullable<FunctionReturnType<typeof api.projectOverview.get>>;
