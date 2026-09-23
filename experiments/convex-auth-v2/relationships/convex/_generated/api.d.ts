/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as branchDeletion from '../branchDeletion.js';
import type * as feedbackSlice from '../feedbackSlice.js';
import type * as fixtures from '../fixtures.js';
import type * as lifecycle from '../lifecycle.js';
import type * as projectStorage from '../projectStorage.js';

declare const fullApi: ApiFromModules<{
	branchDeletion: typeof branchDeletion;
	feedbackSlice: typeof feedbackSlice;
	fixtures: typeof fixtures;
	lifecycle: typeof lifecycle;
	projectStorage: typeof projectStorage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;

export declare const components: {};
