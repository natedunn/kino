import {
	DataModelFromSchemaDefinition,
	DocumentByName,
	GenericMutationCtx,
	GenericSchema,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';
import { ConvexError, GenericId } from 'convex/values';

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
		data: WithoutSystemFields<D> | Partial<WithoutSystemFields<D>>,
		options?: {
			operation?: Operation;
			patchId?: GenericId<TN>;
			onFail?: OnFailCallback<D>;
		}
	): Promise<WithoutSystemFields<D> | Partial<WithoutSystemFields<D>>> => {
		const operation = options?.operation ?? 'insert';
		const patchId = options?.patchId;
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
			 * Patch check
			 */
			if (operation === 'patch') {
				if (!patchId) {
					uniqueRowError(`Unable to patch document without an id.`);
				}

				/**
				 * Check if the existing document matches one of the identifiers
				 * (meaning we're updating the same document, not creating a conflict)
				 */
				const matchedToExisting = (_existing: D | null, _data: Partial<D>) => {
					let idMatchedToExisting: string | null = null;

					if (_existing) {
						for (const identifier of identifiers) {
							if (
								(_existing[identifier] &&
									_data[identifier] &&
									_existing[identifier] === _data[identifier]) ||
								(identifier === '_id' && _existing[identifier] === patchId)
							) {
								idMatchedToExisting = String(identifier);
								break;
							}
						}
					}
					return idMatchedToExisting;
				};

				const checkExisting = (_existing: D | null, _data: Partial<D>) => {
					const matchedId = matchedToExisting(_existing, _data);

					if (!_existing) {
						// No existing found, no conflict
						return;
					}

					if (matchedId) {
						// The existing document is the same one we're patching - OK
						return;
					} else {
						// Found a different document with the same unique values - fail
						onFail?.({
							uniqueRow: {
								existingData: _existing,
							},
						});
						uniqueRowError(
							`In '${tableName}' table, there already exists a value match of the columns: [${fields.join(`,`)}].`
						);
					}
				};

				if (!existing && !columnData && patchId) {
					// No existing results found because there wasn't complete data provided
					// to match the provided index. We need to merge with existing document
					// to check what WOULD be the potential data conflict.
					const match = await ctx.db.get(patchId);

					if (!match) {
						uniqueRowError(`No document found for id ${patchId}`);
						return data; // TypeScript needs this even though we throw
					}

					const extensiveColumnData = constructColumnData(
						fields,
						{
							...match,
							...data,
						},
						{}
					);

					if (extensiveColumnData) {
						const extensiveExisting = await getExisting(extensiveColumnData);
						checkExisting(extensiveExisting, data as Partial<D>);
					} else {
						uniqueRowError(`Incomplete data when there should have been enough.`);
					}
				} else {
					checkExisting(existing, data as Partial<D>);
				}
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
