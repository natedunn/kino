import type { DataModel, Doc } from '@/convex/_generated/dataModel';
import type { Indexes as ExtractIndexes, GenericMutationCtx, NamedTableInfo } from 'convex/server';

import { ConvexError } from 'convex/values';

type UniqueIndexes = {
	[key in keyof DataModel]?: {
		indexes: (keyof ExtractIndexes<NamedTableInfo<DataModel, key>>)[];
		identifiers: (keyof NamedTableInfo<DataModel, key>['document'])[];
	};
};

type ExactTwoUniqueElementsFrom<T extends readonly PropertyKey[]> = {
	[P1 in T[number]]: [P1, Exclude<T[number], P1>];
}[T[number]];

type OptionalIndexFields<T> = {
	[K in keyof T]?: T[K] extends readonly PropertyKey[] ? ExactTwoUniqueElementsFrom<T[K]> : T[K];
};

type UniqueRows = {
	[key in keyof DataModel]?: OptionalIndexFields<ExtractIndexes<NamedTableInfo<DataModel, key>>>;
};

type UneditableColumns = {
	[key in keyof DataModel]?: (keyof DataModel[key]['document'])[];
};

type NonEmptyColumns = {
	[key in keyof DataModel]?: {
		[column in keyof DataModel[key]['document']]?:
			| {
					defaultValue: DataModel[key]['document'][column];
			  }
			| true;
	};
};

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

type VerifyArgs<
	TN extends keyof DataModel,
	TI extends NamedTableInfo<DataModel, TN>,
	D extends Partial<TI['document']>,
> = {
	ctx: Omit<GenericMutationCtx<DataModel>, never>;
	tableName: TN;
	data: D;
	onFail?: (onFailArgs: OnFailArgs<D>) => void;
};

/**
 * Config to generate unique and editable columns verifiers
 *
 * @param args - The arguments to pass to the verify function
 * @returns - Config and functions to verify unique and editable columns
 */
const verifyConfig = ({
	uniqueColumns: UNIQUE_COL_INDEXES,
	uniqueRows: UNIQUE_ROW_INDEXES,
	uneditableColumns: UNEDITABLE_COLUMNS,
	unstable_nonEmptyColumns: NON_EMPTY_COLUMNS,
}: {
	uniqueColumns?: UniqueIndexes;
	uniqueRows?: UniqueRows;
	uneditableColumns?: UneditableColumns;
	unstable_nonEmptyColumns?: NonEmptyColumns;
}) => {
	const configOptions = {
		uniqueColumns: UNIQUE_COL_INDEXES,
		uneditableColumns: UNEDITABLE_COLUMNS,
		uniqueRows: UNIQUE_ROW_INDEXES,
		nonEmptyColumns: NON_EMPTY_COLUMNS,
	};

	const verifyNonEmptyColumns = async <
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx: _,
		tableName,
		data: rawData,
		onFail,
	}: VerifyArgs<TN, TI, D>) => {
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
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx: _,
		tableName,
		data: rawData,
		onFail,
	}: VerifyArgs<TN, TI, D>) => {
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
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: VerifyArgs<TN, TI, D>) => {
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
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: VerifyArgs<TN, TI, D>) => {
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
		const valueOne = (data?.[columnOne] ?? '') as string;
		const columnTwo = index[indexName][1];
		const valueTwo = (data?.[columnTwo] ?? '') as string;

		const existing = await ctx.db
			.query(tableName)
			.withIndex(indexName, (q) => {
				// TODO: Fix this type error, even though it works for now
				// @ts-ignore
				return q.eq(columnOne, valueOne).eq(columnTwo, valueTwo);
			})
			.unique();

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

	// const grouped = async <
	// 	TN extends keyof DataModel,
	// 	TI extends NamedTableInfo<DataModel, TN>,
	// 	D extends Partial<TI['document']>,
	// >({
	// 	ctx,
	// 	tableName,
	// 	data,
	// 	verify,
	// 	onFail,
	// }: VerifyArgs<TN, TI, D> & {
	// 	verify: ('uniqueColumn' | 'uniqueRow' | 'editableColumn')[];
	// }) => {
	// 	let verifiedData = data;

	// 	verifiedData = verify.includes('editableColumn')
	// 		? await verifyColumnEditable({ ctx, tableName, data, onFail })
	// 		: data;

	// 	if (verify.includes('uniqueColumn')) {
	// 		await verifyColumnUniqueness({
	// 			ctx,
	// 			tableName,
	// 			data: verifiedData,
	// 			onFail,
	// 		});
	// 	}

	// 	if (verify.includes('uniqueRow')) {
	// 		await verifyRowUniqueness({ ctx, tableName, data: verifiedData, onFail });
	// 	}

	// 	return {
	// 		data: verifiedData,
	// 	};
	// };

	const all = async <
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: VerifyArgs<TN, TI, D> & {}) => {
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
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: VerifyArgs<TN, TI, D> & {}) => {
		const verifiedData = await all({
			ctx,
			tableName,
			data,
			onFail,
		});

		return ctx.db.insert(
			tableName,
			// @ts-expect-error
			verifiedData.data
		);
	};

	const patch = async <
		TN extends keyof DataModel,
		TI extends NamedTableInfo<DataModel, TN>,
		D extends Partial<TI['document']>,
	>({
		ctx,
		tableName,
		data,
		onFail,
	}: VerifyArgs<TN, TI, D> & {}) => {
		const verifiedData = await all({
			ctx,
			tableName,
			data,
			onFail,
		});

		return ctx.db.patch(
			// @ts-expect-error
			verifiedData.data._id,
			verifiedData.data
		);
	};

	return {
		verify: {
			editableColumn: verifyColumnEditable,
			uniqueColumn: verifyColumnUniqueness,
			uniqueRow: verifyRowUniqueness,
			nonEmptyColumn: verifyNonEmptyColumns,
			insert,
			patch,
			all,
		},
		config: configOptions,
	};
};

// Verify config
export const { verify } = verifyConfig({
	uniqueColumns: {
		user: {
			indexes: ['by_email', 'by_username'],
			identifiers: ['_id'],
		},
	},
	uniqueRows: {
		project: {
			by_orgSlug_slug: ['orgSlug', 'slug'],
		},
		feedbackBoard: {
			by_name_projectId: ['name', 'projectId'],
		},
	},
	uneditableColumns: {
		user: [],
	},
});
