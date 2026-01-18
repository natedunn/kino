import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';

import { DefaultValuesConfigData, MakeOptional } from '../core/types';

/**
 * Creates a default values transform.
 *
 * Makes specified fields optional in insert() by providing default values.
 * Supports both static config objects and dynamic functions (sync or async).
 *
 * @param schema - Your Convex schema definition
 * @param config - Default values config (object or function returning object)
 * @returns Config object for use with verifyConfig
 *
 * @example
 * ```ts
 * // Static config (same values reused)
 * const defaults = defaultValuesConfig(schema, {
 *   posts: { status: 'draft', views: 0 },
 * });
 *
 * // Dynamic config (fresh values on each insert)
 * const defaults = defaultValuesConfig(schema, () => ({
 *   posts: { status: 'draft', slug: generateRandomSlug() },
 * }));
 *
 * // Async config
 * const defaults = defaultValuesConfig(schema, async () => ({
 *   posts: { category: await fetchDefaultCategory() },
 * }));
 * ```
 */
export const defaultValuesConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends DefaultValuesConfigData<DataModel>,
>(
	_schema: S,
	config: C | (() => C | Promise<C>)
) => {
	/**
	 * Apply default values to the data for a given table.
	 * Async to support dynamic config functions.
	 */
	const verify = async <TN extends TableNamesInDataModel<DataModel>>(
		tableName: TN,
		data: MakeOptional<WithoutSystemFields<DocumentByName<DataModel, TN>>, keyof C[TN]>
	): Promise<WithoutSystemFields<DocumentByName<DataModel, TN>>> => {
		// Resolve config - handle both direct object and function forms
		const resolvedConfig = typeof config === 'function' ? await config() : config;

		return {
			...(resolvedConfig[tableName] as Partial<WithoutSystemFields<DocumentByName<DataModel, TN>>>),
			...(data as WithoutSystemFields<DocumentByName<DataModel, TN>>),
		};
	};

	return {
		_type: 'defaultValues' as const,
		verify,
		config,
	};
};
