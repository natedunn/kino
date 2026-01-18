import { GenericMutationCtx, GenericSchema, SchemaDefinition } from 'convex/server';
import { GenericId } from 'convex/values';

import { OnFailCallback } from './types';

// =============================================================================
// Plugin Types
// =============================================================================

/**
 * Context passed to validate plugin functions.
 *
 * Provides access to:
 * - `ctx` - Full Convex mutation context (includes `ctx.db` for queries)
 * - `tableName` - The table being operated on
 * - `operation` - 'insert' or 'patch'
 * - `patchId` - Document ID (only for patch operations)
 * - `onFail` - Callback to report validation failures before throwing
 * - `schema` - Optional schema reference (if provided by verifyConfig)
 */
export type ValidateContext<TN extends string = string> = {
	/** Full Convex mutation context - use ctx.db for database queries */
	ctx: Omit<GenericMutationCtx<any>, never>;
	/** Table name being operated on */
	tableName: TN;
	/** Operation type: 'insert' or 'patch' */
	operation: 'insert' | 'patch';
	/** Document ID (only available for patch operations) */
	patchId?: GenericId<any>;
	/** Callback for validation failures - call before throwing to provide details */
	onFail?: OnFailCallback<any>;
	/** Schema reference (if provided to verifyConfig) */
	schema?: SchemaDefinition<GenericSchema, boolean>;
};

/**
 * A validate plugin that can check data during insert/patch operations.
 *
 * Validate plugins:
 * - Run AFTER transform plugins (like defaultValues)
 * - Can be async (use await for API calls, db queries, etc.)
 * - Can throw errors to prevent the operation
 * - Should return the data unchanged (validation only, no transformation)
 * - Do NOT affect the TypeScript types of the input data
 *
 * @example
 * ```ts
 * // Simple sync plugin
 * const requiredFields = createValidatePlugin(
 *   'requiredFields',
 *   { fields: ['title', 'content'] },
 *   {
 *     insert: (context, data) => {
 *       for (const field of config.fields) {
 *         if (!data[field]) {
 *           throw new ConvexError({ message: `Missing required field: ${field}` });
 *         }
 *       }
 *       return data;
 *     },
 *   }
 * );
 *
 * // Async plugin with database query
 * const checkOwnership = createValidatePlugin(
 *   'checkOwnership',
 *   {},
 *   {
 *     patch: async (context, data) => {
 *       const existing = await context.ctx.db.get(context.patchId);
 *       if (existing?.ownerId !== getCurrentUserId()) {
 *         throw new ConvexError({ message: 'Not authorized' });
 *       }
 *       return data;
 *     },
 *   }
 * );
 * ```
 */
export interface ValidatePlugin<Type extends string = string, Config = unknown> {
	/** Unique identifier for this plugin */
	readonly _type: Type;

	/** Plugin configuration */
	readonly config: Config;

	/** Verify functions for insert and/or patch operations */
	verify: {
		/**
		 * Validate data for insert operations.
		 * Can be sync or async.
		 *
		 * @param context - Plugin context with ctx, tableName, schema, etc.
		 * @param data - The data to validate (after transforms applied)
		 * @returns The data unchanged (or Promise resolving to data)
		 * @throws ConvexError if validation fails
		 */
		insert?: (context: ValidateContext, data: any) => Promise<any> | any;

		/**
		 * Validate data for patch operations.
		 * Can be sync or async.
		 *
		 * @param context - Plugin context with ctx, tableName, patchId, schema, etc.
		 * @param data - The partial data to validate
		 * @returns The data unchanged (or Promise resolving to data)
		 * @throws ConvexError if validation fails
		 */
		patch?: (context: ValidateContext, data: any) => Promise<any> | any;
	};
}

/**
 * Type guard to check if something is a ValidatePlugin
 */
export function isValidatePlugin(obj: unknown): obj is ValidatePlugin {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'_type' in obj &&
		typeof (obj as any)._type === 'string' &&
		'verify' in obj &&
		typeof (obj as any).verify === 'object'
	);
}

// =============================================================================
// Plugin Collection Types
// =============================================================================

/**
 * A collection of validate plugins
 */
export type ValidatePluginRecord = Record<string, ValidatePlugin>;

// =============================================================================
// Plugin Helpers
// =============================================================================

/**
 * Run all validate plugins for an operation.
 * Plugins are run in order and each receives the output of the previous.
 * All plugin verify functions are awaited (supports async plugins).
 */
export async function runValidatePlugins(
	plugins: ValidatePlugin[],
	context: ValidateContext,
	data: any
): Promise<any> {
	let result = data;

	for (const plugin of plugins) {
		const verifyFn = context.operation === 'insert' ? plugin.verify.insert : plugin.verify.patch;

		if (verifyFn) {
			// Always await - works for both sync and async functions
			result = await verifyFn(context, result);
		}
	}

	return result;
}

/**
 * Helper to create a validate plugin with proper typing.
 *
 * @param type - Unique identifier for this plugin type
 * @param config - Plugin configuration data
 * @param verify - Object with insert and/or patch verify functions
 * @returns A ValidatePlugin instance
 *
 * @example
 * ```ts
 * const myPlugin = createValidatePlugin(
 *   'myPlugin',
 *   { maxLength: 100 },
 *   {
 *     insert: async (context, data) => {
 *       // Validation logic here
 *       return data;
 *     },
 *   }
 * );
 * ```
 */
export function createValidatePlugin<Type extends string, Config>(
	type: Type,
	config: Config,
	verify: ValidatePlugin<Type, Config>['verify']
): ValidatePlugin<Type, Config> {
	return {
		_type: type,
		config,
		verify,
	};
}
