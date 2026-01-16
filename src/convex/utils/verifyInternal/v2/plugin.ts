import { GenericMutationCtx } from 'convex/server';
import { GenericId } from 'convex/values';

import { OnFailCallback } from './types';

// =============================================================================
// Plugin Types
// =============================================================================

/**
 * Context passed to validate plugin functions
 */
export type ValidateContext<TN extends string = string> = {
	/** Convex mutation context */
	ctx: Omit<GenericMutationCtx<any>, never>;
	/** Table name being operated on */
	tableName: TN;
	/** Operation type */
	operation: 'insert' | 'patch';
	/** Document ID (only for patch) */
	patchId?: GenericId<any>;
	/** Callback for validation failures */
	onFail?: OnFailCallback<any>;
};

/**
 * A validate plugin that can check data during insert/patch operations.
 *
 * Validate plugins:
 * - Run AFTER transform plugins (like defaultValues)
 * - Can throw errors to prevent the operation
 * - Return the data unchanged (or slightly modified for normalization)
 * - Do NOT affect the TypeScript types of the input data
 *
 * @example
 * ```ts
 * const myValidator: ValidatePlugin = {
 *   _type: 'myValidator',
 *   config: { ... },
 *   verify: {
 *     insert: async (context, data) => {
 *       if (!isValid(data)) {
 *         context.onFail?.({ ... });
 *         throw new ConvexError({ message: 'Invalid data' });
 *       }
 *       return data;
 *     },
 *   },
 * };
 * ```
 */
export interface ValidatePlugin<Type extends string = string, Config = unknown> {
	/** Unique identifier for this plugin */
	readonly _type: Type;

	/** Plugin configuration */
	readonly config: Config;

	/** Verify functions */
	verify: {
		/**
		 * Validate data for insert operations.
		 * @param context - Plugin context with ctx, tableName, etc.
		 * @param data - The data to validate (after transforms applied)
		 * @returns The data (unchanged or normalized)
		 * @throws ConvexError if validation fails
		 */
		insert?: (context: ValidateContext, data: any) => Promise<any> | any;

		/**
		 * Validate data for patch operations.
		 * @param context - Plugin context with ctx, tableName, patchId, etc.
		 * @param data - The partial data to validate
		 * @returns The data (unchanged or normalized)
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
 * Run all validate plugins for an operation
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
			result = await verifyFn(context, result);
		}
	}

	return result;
}

/**
 * Helper to create a validate plugin with proper typing
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
