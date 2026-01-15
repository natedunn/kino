import type {
	DataModelFromSchemaDefinition,
	DocumentByName,
	Indexes as ExtractIndexes,
	GenericMutationCtx,
	GenericQueryCtx,
	GenericSchema,
	NamedTableInfo,
	SchemaDefinition,
	// SystemTableNames,
	TableNamesInDataModel,
	UserIdentity,
	WithoutSystemFields,
} from 'convex/server';

import { ConvexError, GenericId } from 'convex/values';

import { constructColumnData, constructIndexData } from './construct';
import {
	ConfigOptionsArg,
	OnFailArgs,
	UniqueIndexes,
	UniqueRowConfig,
	UniqueRowConfigOptions,
} from './types';

type Operation = 'insert' | 'patch' | 'query';
type DMGeneric = DataModelFromSchemaDefinition<SchemaDefinition<any, boolean>>;

type UneditableColumns<DM extends DMGeneric> = {
	[key in keyof DM]?: (keyof DM[key]['document'])[];
};

type NonEmptyColumns<DM extends DMGeneric> = {
	[key in keyof DM]?: {
		[column in keyof DM[key]['document']]?:
			| {
					defaultValue: DM[key]['document'][column];
			  }
			| true;
	};
};

/**
 * Verify Column Uniqueness
 */
export const verifyColumnUniqueness = async <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
	D extends Partial<DocumentByName<DataModel, TN>>,
>({
	ctx,
	schema: _schema,
	indexes,
	tableName,
	data,
	onFail,
}: {
	ctx: Omit<GenericMutationCtx<DataModel>, never>;
	schema: S;
	indexes: UniqueIndexes<DataModel>;
	tableName: TN;
	data: D;
	onFail?: (onFailArgs: OnFailArgs<D>) => void;
}) => {
	const uniqueIndex = indexes?.[tableName] ?? null;

	type TableIndexes = ExtractIndexes<NamedTableInfo<DataModel, TN>>;

	if (!uniqueIndex) {
		console.warn(`No unique indexes found for table: [${tableName}]`);
		return;
	}

	const _indexes = uniqueIndex['indexes'];

	outerFor: for (const i of _indexes) {
		const index = String(i);

		const columnName = index.replace('by_', '') as TableIndexes[typeof index][0];

		const value = data[columnName];

		if (!value || !columnName) {
			console.warn('No value or column name found for index', index);
			continue;
		}

		const existing = await ctx.db
			.query(tableName)
			.withIndex(index, (q) => q.eq(columnName, value))
			.unique();

		const identifiers = indexes?.[tableName]?.['identifiers'];

		if (!identifiers || identifiers.length === 0) {
			return;
		}

		for (const i of identifiers) {
			const identifier = String(i);

			if (existing && existing[identifier] === data[identifier]) {
				console.info(
					`👍 Identifier of [${identifier as string}] matched. Skipping [${columnName}]`
				);
				continue outerFor;
			}
		}

		if (existing) {
			onFail?.({
				uniqueColumn: {
					conflictingColumn: columnName,
					existingData: existing,
				},
			});

			throw new ConvexError({
				message: `🚫 UNIQUE COLUMN VERIFICATION ERROR: In [${tableName}] table, there already exists value "${
					data[columnName as TableIndexes[typeof index][0]]
				}" in column [${columnName}].`,
				code: 'UNIQUE_COLUMN_VERIFICATION_ERROR',
			});
		}
	}
};

/**
 * Unique row verification
 */
export const verifyRowUniqueness = async <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
	O extends Operation,
	D extends DocumentByName<DataModel, TN>,
>({
	ctx,
	schema,
	indexData,
	tableName,
	data,
	operation,
	patchId,
	onFail,
}: {
	ctx: Omit<GenericMutationCtx<DataModel>, never>;
	schema: S;
	indexData: UniqueRowConfig<DataModel> | undefined;
	tableName: TN;
	data: Operation extends 'patch' ? Partial<D> : D;
	operation: O;
	patchId?: string;
	onFail?: (onFailArgs: OnFailArgs<D>) => void;
}) => {
	const uniqueRowError = (message: string) => {
		throw new ConvexError({
			message,
			code: 'UNIQUE_ROW_VERIFICATION_ERROR',
		});
	};

	const indexesData = constructIndexData(schema, tableName, indexData);

	console.log('indexesData >>>>>', indexesData, data);

	if (!indexesData && !!indexData) {
		uniqueRowError(`Index data was not found where there should have been.`);
	}

	// No indexes provided.
	if (!indexesData) {
		return;
	}

	let count = 0;
	for (const i of indexesData) {
		const { name, fields, identifiers, ...rest } = i;

		console.log(`🔍 [${count + 1}] Checking row uniqueness for index ${name}...`);

		const _options = rest as UniqueRowConfigOptions;

		if (!fields[0] && !fields[1]) {
			uniqueRowError(
				`Error in 'verifyRowUniqueness()'. There must be two columns to test against. If you are attempting to enforce a unique column, use the 'uniqueColumns' config option.`
			);
		}

		// const identifiers = indexesData?.['identifiers'] ?? ['_id'];

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
				// TODO: add option to make this throw instead of warn
				console.warn(
					`⚠️ There was more than one existing result found for index ${name}. Check the following IDs:`,
					existingByIndex.map((r) => r._id)
				);
				console.warn(
					`⚠️ It is recommended that you triage the rows listed above since they have data that go against a rule of row uniqueness.`
				);
			}

			return existingByIndex.length > 0 ? existingByIndex[0] : null;
		};

		const existing = await getExisting(columnData);

		/**
		 * Insert check
		 */
		if (operation === 'insert') {
			console.log('Verifying insert...', data);

			if (!existing) {
				// All good, verify passes
				return;
			}

			// No need to check `idMatchedToExisting` because we are inserting
			// a brand new document
			if (existing) {
				onFail?.({
					uniqueRow: {
						existingData: existing,
					},
				});
				uniqueRowError(
					`Unable to [${operation}] document. In table [${tableName}], there is a existing row that has the same data combination in the columns: [${fields.join(`, `)}].`
				);
			}
		}

		/**
		 * Patch check
		 */
		if (operation === 'patch' && !patchId) {
			uniqueRowError(`Unable to patch document without an id.`);
		}

		if (operation === 'patch' && patchId) {
			console.log('Verifying patch...', patchId, data);

			const matchedToExisting = (_existing: D | null, _data: Partial<D>) => {
				let idMatchedToExisting: string | null = null;

				if (_existing) {
					console.log(`Found an existing match for index ${name}. Checking identifiers...`);

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
					console.log('No existing found. It does not conflict.');
					return;
				}

				if (matchedId) {
					console.info(
						`👍 Identifier of '${matchedId}' matched. Skipping check for index '${name}' and fields [${fields.join(`,`)}]`
					);
					return;
				} else {
					onFail?.({
						uniqueRow: {
							existingData: _existing,
						},
					});
					uniqueRowError(
						`In '${tableName}' table, there already exists a value match of the two columns: [${fields.join(`,`)}].`
					);
				}
			};

			if (!existing && !columnData) {
				// This means there were no existing results found BECAUSE there wasn't complete data provided to match the provided index.
				//
				// If we want to go the extra mile we can get the match to check what WOULD be the potential data conflict
				const match = await ctx.db.get(tableName, patchId as GenericId<TN>);

				if (!match) {
					return uniqueRowError(`No document fount for id ${patchId}`);
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

					console.log(extensiveExisting);
					checkExisting(extensiveExisting, data);
				} else {
					uniqueRowError(`Incomplete data when there should have been enough.`);
				}
			}

			checkExisting(existing, data);
		}
		count++;
		return;
	}
};

/**
 * Verify Column Editable
 */
const verifyColumnEditable = async <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
	D extends Partial<DocumentByName<DataModel, TN>>,
>({
	ctx: _ctx,
	indexData,
	tableName,
	data: rawData,
	onFail,
}: {
	ctx: Omit<GenericMutationCtx<DataModel>, never>;
	indexData: UneditableColumns<DataModel>;
	tableName: TN;
	data: D;
	onFail?: (onFailArgs: OnFailArgs<D>) => void;
}) => {
	const systemColumns = ['_id', '_creationTime'];

	const uneditableColumns = [...systemColumns, ...(indexData?.[tableName] ?? [])];

	let data = rawData;
	let removedColumns: string[] = [];

	for (const c of uneditableColumns) {
		const column = c.toString();
		const columnInData = !!data[column];

		if (!columnInData) continue;

		if (columnInData) {
			removedColumns.push(column);

			console.warn(`Column: [${column}] is uneditable. Removing from data`);
			delete data[column];
		}
	}

	if (removedColumns.length > 0) {
		onFail?.({
			editableColumn: {
				removedColumns,
				filteredData: data,
			},
		});
	}

	// Return filtered data
	return data;
};

/**
 * Verify Non-Empty Columns
 */
const verifyNonEmptyColumns = async <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
	D extends Partial<DocumentByName<DataModel, TN>>,
>({
	ctx: _ctx,
	indexData,
	tableName,
	data: rawData,
	onFail,
}: {
	ctx: Omit<GenericMutationCtx<DataModel>, never>;
	indexData: NonEmptyColumns<DataModel>;
	tableName: TN;
	data: D;
	onFail?: (onFailArgs: OnFailArgs<D>) => void;
}) => {
	const columns = indexData?.[tableName];

	if (!columns) {
		return rawData;
	}

	let data = rawData;
	let updatedData = {};

	const columnKeys = Object.keys(columns);

	for (const c of columnKeys) {
		const column = c;

		const value = rawData?.[column];

		const isUndefined = value === undefined;
		const isNull = value === null;
		const isEmptyString = value?.trim() === '';
		const isEmpty = isUndefined || isNull || isEmptyString;

		if (columns[column] === true && isEmpty) {
			onFail?.({
				requiredColumn: {
					missingColumn: column,
				},
			});
			throw new ConvexError({
				message: `🚫 Required column [${column.toString()}] is missing in table [${tableName}]`,
				code: 'REQUIRED_COLUMN_MISSING',
			});
		}

		if (columns[column] !== true && !!columns[column]?.defaultValue && isEmpty) {
			updatedData = {
				...updatedData,
				[column]: columns[column].defaultValue,
			};
		}
	}

	return {
		...data,
		...updatedData,
	};
};

/**
 * Auth check
 */
type AuthArgs<D, T extends boolean | undefined> = {
	throw?: T;
	onFail?: (onFailArgs: OnFailArgs<D>) => void;
};

type AuthReturn<T extends boolean | undefined> = T extends true
	? { userIdentity: UserIdentity; userId: string }
	: { userIdentity: UserIdentity | null; userId: string | null };

const verifyAuth = async <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	TN extends TableNamesInDataModel<DataModel>,
	D extends DocumentByName<DataModel, TN>,
	T extends boolean | undefined = undefined,
>(
	ctx: Omit<GenericMutationCtx<DataModel>, never> | Omit<GenericQueryCtx<DataModel>, never>,
	args?: AuthArgs<D, T>
): Promise<AuthReturn<T>> => {
	const shouldThrow = (args?.throw ?? false) as boolean;
	const userIdentity = await ctx.auth.getUserIdentity();

	if (shouldThrow) {
		if (!userIdentity) {
			args?.onFail?.({
				reason: 'unauthenticated',
				userIdentity: null,
				userId: null,
			} as OnFailArgs<D>);
			throw new ConvexError({
				message: 'Unauthorized — no user is authenticated',
				code: '401',
			});
		}
		return { userIdentity, userId: userIdentity.subject } as AuthReturn<T>;
	}

	if (!userIdentity) {
		args?.onFail?.({
			reason: 'unauthenticated',
			userIdentity: null,
		} as OnFailArgs<D>);
		return { userIdentity: null, userId: null } as AuthReturn<T>;
	}

	return { userIdentity, userId: userIdentity.subject } as AuthReturn<T>;
};

// type MakeKeysOptional<T, K extends PropertyKey> = {
// 	[P in keyof T]: P extends K ? T[P] | undefined : T[P];
// };

/**
 * Helper type to extract literal keys from a defaultValues config
 */
// type ExtractDefaultKeys<DV, TN extends PropertyKey, DocKeys extends PropertyKey> =
// 	DV extends Record<PropertyKey, any>
// 		? TN extends keyof DV
// 			? DV[TN] extends Record<PropertyKey, any>
// 				? keyof DV[TN] & DocKeys
// 				: never
// 			: never
// 		: never;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type MakeOptional<T, K extends PropertyKey> = Prettify<
	Omit<T, K & keyof T> & Partial<Pick<T, K & keyof T>>
>;

export const verifyConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
	// const DV extends Record<string, Record<string, unknown>>,
	// CO extends Omit<ConfigOptionsArg<DataModel>, 'defaultValues'>,
	// const CO extends ConfigOptionsArg<DataModel>,
	CO,
>(
	schema: S,
	// configOptions: CO &
	// 	ConfigOptionsArg<DataModel> & {
	// 		[K in Exclude<keyof CO, keyof ConfigOptionsArg<DataModel>>]: never;
	// 	}
	configOptions: CO & ConfigOptionsArg<DataModel>
) => {
	const verifyDefaultValues = async <TN extends TableNamesInDataModel<DataModel>>({
		ctx: _ctx,
		tableName: _tableName,
		data,
		test: _test,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: MakeOptional<
			WithoutSystemFields<DocumentByName<DataModel, TN>>,
			// 'slug' | 'status' | 'upvotes' // this will eventually be dynamically replaced
			CO extends { defaultValues: infer DV }
				? TN extends keyof DV
					? keyof DV[TN & keyof DV]
					: never
				: never
		>;
		test?: CO extends { defaultValues: infer DV }
			? TN extends keyof DV
				? keyof DV[TN & keyof DV]
				: never
			: never;
	}) => {
		return {
			...configOptions.defaultValues?.[_tableName],
			...data,
		} as WithoutSystemFields<DocumentByName<DataModel, TN>>;
	};

	const verifyAll = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>({
		ctx,
		tableName,
		data,
		operation,
		patchId,
		onFail,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		operation: 'insert' | 'patch' | 'query';
		patchId?: string;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		let verifiedData = data;

		if (configOptions.uneditableColumns?.[tableName]) {
			verifiedData = await verifyColumnEditable({
				ctx,
				indexData: configOptions.uneditableColumns,
				tableName,
				data,
				onFail,
			});
		}

		if (configOptions.nonEmptyColumns?.[tableName]) {
			verifiedData = await verifyNonEmptyColumns({
				ctx,
				indexData: configOptions.nonEmptyColumns,
				tableName,
				data: verifiedData,
				onFail,
			});
		}

		if (configOptions.uniqueColumns?.[tableName]) {
			await verifyColumnUniqueness({
				ctx,
				schema,
				tableName,
				indexes: configOptions.uniqueColumns,
				data: verifiedData,
				onFail,
			});
		}

		if (configOptions.uniqueRows?.[tableName]) {
			await verifyRowUniqueness({
				ctx,
				schema,
				tableName,
				indexData: configOptions.uniqueRows,
				data: verifiedData,
				operation,
				patchId,
				onFail,
			});
		}

		return {
			data: verifiedData,
		};
	};

	/**
	 * Insert document
	 */
	const insert = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends WithoutSystemFields<DocumentByName<DataModel, TN>>,
	>(args: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		const verifiedData = await verifyAll({
			...args,
			operation: 'insert',
		});

		const { _id, _creationTime, ...rest } = verifiedData.data;

		// const dv = await verifyDefaultValues({
		// 	ctx: args.ctx,
		// 	tableName: args.tableName,
		// 	data: rest as WithoutSystemFields<D>,
		// })

		const id = args.ctx.db.insert(args.tableName, rest as WithoutSystemFields<D>);
		return id;
	};

	/**
	 * Patch document
	 */
	const patch = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>(
		ctx: Omit<GenericMutationCtx<DataModel>, never>,
		tableName: TN,
		id: string,
		data: D,
		event?: {
			onFail?: (onFailArgs: OnFailArgs<D>) => void;
		}
	) => {
		const verifiedData = await verifyAll({
			ctx,
			tableName,
			data,
			onFail: event?.onFail,
			operation: 'patch',
			patchId: id,
		});

		const { _id, ...rest } = verifiedData.data;

		if (!rest || Object.keys(rest).length === 0) {
			console.warn(`No data to patch. Skipping the patch.`, {
				table: tableName,
				_id: id,
			});
		}

		await ctx.db.patch(
			id as string & {
				__tableName: TN;
			},
			verifiedData.data
		);
	};

	return {
		verify: {
			editableColumn: verifyColumnEditable,
			uniqueColumn: verifyColumnUniqueness,
			uniqueRow: verifyRowUniqueness,
			nonEmptyColumn: verifyNonEmptyColumns,
			defaultValues: verifyDefaultValues,
			auth: verifyAuth,
			all: verifyAll,
			insert,
			patch,
		},
		config: configOptions,
	};
};
