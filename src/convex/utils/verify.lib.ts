import type {
	DataModelFromSchemaDefinition,
	DocumentByName,
	Indexes as ExtractIndexes,
	GenericMutationCtx,
	GenericQueryCtx,
	GenericSchema,
	NamedTableInfo,
	SchemaDefinition,
	TableNamesInDataModel,
	UserIdentity,
	WithoutSystemFields,
} from 'convex/server';

import { ConvexError } from 'convex/values';

type DMGeneric = DataModelFromSchemaDefinition<SchemaDefinition<any, boolean>>;

type UniqueIndexes<DM extends DMGeneric> = {
	[key in keyof DM]?: {
		indexes: (keyof ExtractIndexes<NamedTableInfo<DM, key>>)[];
		identifiers: (keyof NamedTableInfo<DM, key>['document'])[];
	};
};

type ExactTwoUniqueElementsFrom<T extends readonly PropertyKey[]> = {
	[P1 in T[number]]: [P1, Exclude<T[number], P1>];
}[T[number]];

type OptionalIndexFields<T> = {
	[K in keyof T]?: T[K] extends readonly PropertyKey[] ? ExactTwoUniqueElementsFrom<T[K]> : T[K];
};

type UniqueRows<DM extends DMGeneric> = {
	[key in keyof DM]?: OptionalIndexFields<ExtractIndexes<NamedTableInfo<DM, key>>> & {
		identifiers: (keyof NamedTableInfo<DM, key>['document'])[];
	};
};

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

export type Doc<TableName extends TableNamesInDataModel<DMGeneric>> = DocumentByName<
	DMGeneric,
	TableName
>;

type OnFailArgs<D> = {
	uniqueColumn?: {
		conflictingColumn: keyof D;
		existingData: D;
	};
	uniqueRow?: {
		existingData: D;
	};
	editableColumn?: {
		removedColumns: string[];
		filteredData: D;
	};
	requiredColumn?: {
		missingColumn: keyof D;
	};
};

export const verifyConfig = <
	S extends SchemaDefinition<GenericSchema, boolean>,
	DataModel extends DataModelFromSchemaDefinition<S>,
>(
	_schema: S,
	{
		uniqueColumns: UNIQUE_COL_INDEXES,
		uniqueRows: UNIQUE_ROW_INDEXES,
		uneditableColumns: UNEDITABLE_COLUMNS,
		unstable_nonEmptyColumns: NON_EMPTY_COLUMNS,
	}: {
		uniqueColumns?: UniqueIndexes<DataModel>;
		uniqueRows?: UniqueRows<DataModel>;
		uneditableColumns?: UneditableColumns<DataModel>;
		unstable_nonEmptyColumns?: NonEmptyColumns<DataModel>;
	}
) => {
	const configOptions = {
		uniqueColumns: UNIQUE_COL_INDEXES,
		uneditableColumns: UNEDITABLE_COLUMNS,
		uniqueRows: UNIQUE_ROW_INDEXES,
		nonEmptyColumns: NON_EMPTY_COLUMNS,
	};

	const verifyNonEmptyColumns = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>({
		ctx: _,
		tableName,
		data: rawData,
		onFail,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		const columns = NON_EMPTY_COLUMNS?.[tableName];

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
	 * Helper function to check if a column is editable in the database.
	 *
	 * @param ctx - The context object
	 * @param tableName - The name of the table to check
	 * @param rawData  - The data to check
	 * @param onConflict  - A callback function to handle conflicts
	 */
	const verifyColumnEditable = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>({
		ctx: _,
		tableName,
		data: rawData,
		onFail,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		const systemColumns = ['_id', '_creationTime'];

		const uneditableColumns = [...systemColumns, ...(UNEDITABLE_COLUMNS?.[tableName] ?? [])];

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
	 * Helper function to check if a column is unique in the database.
	 *
	 * @param ctx - The context object
	 * @param tableName - The name of the table to check
	 * @param data - The data to check
	 * @param onConflict - A callback function to handle conflicts
	 */
	const verifyColumnUniqueness = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		const uniqueIndex = UNIQUE_COL_INDEXES?.[tableName] ?? null;

		type TableIndexes = ExtractIndexes<NamedTableInfo<DataModel, TN>>;

		if (!uniqueIndex) {
			console.warn(`No unique indexes found for table: [${tableName}]`);
			return;
		}

		const indexes = uniqueIndex['indexes'];

		outerFor: for (const index of indexes) {
			const columnName = index.toString().replace('by_', '') as TableIndexes[typeof index][0];

			const value = data[columnName];

			if (!value || !columnName) {
				console.warn('No value or column name found for index', index);
				continue;
			}

			const existing = (await ctx.db
				.query(tableName)
				.withIndex(index, (q) => q.eq(columnName, value))
				.unique()) as Doc<TN> | null;

			const identifiers = UNIQUE_COL_INDEXES?.[tableName]?.['identifiers'];

			if (!identifiers || identifiers.length === 0) {
				return;
			}

			for (const identifier of identifiers) {
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
	const verifyRowUniqueness = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		type Indexes = ExtractIndexes<NamedTableInfo<DataModel, TN>>;

		const index = UNIQUE_ROW_INDEXES?.[tableName] ?? null;

		if (!index) {
			console.warn(`No unique indexes found for table: [${tableName}]`);
			return;
		}

		const indexName = (index && (Object.keys(index)[0] as keyof Indexes)).toString();

		if (!indexName || !index[indexName] || index[indexName].length <= 0) {
			console.warn(`No index columns found found for index: [${indexName}]`);
			return;
		}

		const columnOne = index[indexName][0];
		const valueOne = data?.[columnOne];
		const columnTwo = index[indexName][1];
		const valueTwo = data?.[columnTwo];

		if (!valueOne || !valueTwo) {
			throw new Error('verifyRowUniqueness requires two values. One or both were empty.');
		}

		const existing = await ctx.db
			.query(tableName)
			.withIndex(indexName, (q) => {
				return (
					q
						.eq(columnOne, valueOne)
						// This type is hard to guarantee (that it can chain
						// another `eq`) but we are doing type checking on the
						// config to help prevent an issues here.
						//
						// @ts-expect-error
						.eq(columnTwo, valueTwo)
				);
			})
			.unique();

		const identifiers = UNIQUE_ROW_INDEXES?.[tableName]?.['identifiers'];

		if (!identifiers || identifiers.length === 0) {
			return;
		}

		for (const identifier of identifiers) {
			if (existing && existing[identifier] === data[identifier]) {
				console.info(
					`👍 Identifier of [${identifier as string}] matched. Skipping check for [${columnOne}] and [${columnTwo}]`
				);
				return;
			}
		}

		if (existing) {
			onFail?.({
				uniqueRow: {
					existingData: existing,
				},
			});

			throw new ConvexError({
				message: `🚫 UNIQUE ROW VERIFICATION ERROR: In [${tableName}] table, there already exists a value match of the two columns: [${columnOne}] and [${columnTwo}].`,
				code: 'UNIQUE_ROW_VERIFICATION_ERROR',
			});
		}
	};

	const verifyAll = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		let verifiedData = data;

		if (configOptions.uneditableColumns?.[tableName]) {
			verifiedData = await verifyColumnEditable({
				ctx,
				tableName,
				data,
				onFail,
			});
		}

		if (configOptions.nonEmptyColumns?.[tableName]) {
			verifiedData = await verifyNonEmptyColumns({
				ctx,
				tableName,
				data: verifiedData,
				onFail,
			});
		}

		if (configOptions.uniqueColumns?.[tableName]) {
			await verifyColumnUniqueness({
				ctx,
				tableName,
				data: verifiedData,
				onFail,
			});
		}

		if (configOptions.uniqueRows?.[tableName]) {
			await verifyRowUniqueness({
				ctx,
				tableName,
				data: verifiedData,
				onFail,
			});
		}

		return {
			data: verifiedData,
		};
	};

	const insert = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends WithoutSystemFields<DocumentByName<DataModel, TN>>,
	>(args: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		const verifiedData = await verifyAll(args);

		const { _id, _creationTime, ...rest } = verifiedData.data;

		return args.ctx.db.insert(args.tableName, rest as WithoutSystemFields<D>);
	};

	const patch = async <
		TN extends TableNamesInDataModel<DataModel>,
		D extends Partial<DocumentByName<DataModel, TN>> & {
			// We override this type because Convex requires it for patching
			_id: string;
		},
	>(args: {
		ctx: Omit<GenericMutationCtx<DataModel>, never>;
		tableName: TN;
		data: D;
		onFail?: (onFailArgs: OnFailArgs<D>) => void;
	}) => {
		const verifiedData = await verifyAll(args);

		return args.ctx.db.patch(
			args.data._id as string & {
				__tableName: TN;
			},
			verifiedData.data
		);
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

	const auth = async <
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

	return {
		verify: {
			editableColumn: verifyColumnEditable,
			uniqueColumn: verifyColumnUniqueness,
			uniqueRow: verifyRowUniqueness,
			nonEmptyColumn: verifyNonEmptyColumns,
			all: verifyAll,
			insert,
			patch,
			auth,
		},
		config: configOptions,
	};
};
