import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericMutationCtx,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';
import { ConvexError } from 'convex/values';

import { constructColumnData, constructIndexData } from './helpers';
import { OnFailCallback, UniqueRowConfigData, UniqueRowConfigOptions } from './types';

type Operation = 'insert' | 'patch';

export const uniqueRowConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	const C extends UniqueRowConfigData<DataModel>,
>(
	schema: S,
	config: C
) => {
	/**
	 * Verify row uniqueness - throws if not unique
	 * Returns the data unchanged if unique
	 */
	const verify = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends DocumentByName<DataModel, TN>,
	>(
		ctx: Omit<GenericMutationCtx<DataModel>, never>,
		tableName: TN,
		data: WithoutSystemFields<D>,
		options?: {
			operation?: Operation;
			onFail?: OnFailCallback<D>;
		}
	): Promise<WithoutSystemFields<D>> => {
		const operation = options?.operation ?? 'insert';
		const onFail = options?.onFail;

		const uniqueRowError = (message: string) => {
			throw new ConvexError({
				message,
				code: 'UNIQUE_ROW_VERIFICATION_ERROR',
			});
		};

		const indexesData = constructIndexData(schema, tableName, config);

		if (!indexesData && !!config[tableName]) {
			uniqueRowError(`Index data was not found where there should have been.`);
		}

		// No indexes provided for this table
		if (!indexesData) {
			return data;
		}

		for (const indexInfo of indexesData) {
			const { name, fields, identifiers, ...rest } = indexInfo;
			const _options = rest as UniqueRowConfigOptions;

			if (!fields[0] && !fields[1]) {
				uniqueRowError(
					`Error in 'verifyRowUniqueness()'. There must be two columns to test against. If you are attempting to enforce a unique column, use the 'uniqueColumns' config option.`
				);
			}

			const columnData = constructColumnData(fields, data, {});

			const getExisting = async (cd: ReturnType<typeof constructColumnData>) => {
				let existingByIndex: D[] = [];

				if (!cd) {
					existingByIndex = [];
				} else {
					existingByIndex = await ctx.db
						.query(tableName)
						.withIndex(name, (q) =>
							cd.reduce((query: any, { column, value }) => query.eq(column, value), q)
						)
						.collect();
				}

				if (existingByIndex.length > 1) {
					console.warn(
						`There was more than one existing result found for index ${name}. Check the following IDs:`,
						existingByIndex.map((r) => r._id)
					);
					console.warn(
						`It is recommended that you triage the rows listed above since they have data that go against a rule of row uniqueness.`
					);
				}

				return existingByIndex.length > 0 ? existingByIndex[0] : null;
			};

			const existing = await getExisting(columnData);

			/**
			 * Insert check
			 */
			if (operation === 'insert') {
				if (!existing) {
					// All good, verify passes for this index, continue to next
					continue;
				}

				// Found existing - fail
				onFail?.({
					uniqueRow: {
						existingData: existing,
					},
				});
				uniqueRowError(
					`Unable to [${operation}] document. In table [${tableName}], there is an existing row that has the same data combination in the columns: [${fields.join(`, `)}].`
				);
			}

			/**
			 * Patch check - for future use
			 * Note: patch logic is more complex and requires patchId
			 * We'll implement this when we tackle patch()
			 */
			if (operation === 'patch') {
				// For now, skip patch validation in uniqueRow
				// This would need patchId to properly check if updating the same document
				continue;
			}
		}

		return data;
	};

	return {
		_type: 'uniqueRow' as const,
		verify,
		config: config as C,
		schema,
	};
};
