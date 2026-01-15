import type {
	DataModelFromSchemaDefinition,
	Indexes,
	NamedTableInfo,
	SchemaDefinition,
	TableNamesInDataModel,
	WithoutSystemFields,
} from 'convex/server';

/**
 * Util types
 */
export type DMGeneric = DataModelFromSchemaDefinition<SchemaDefinition<any, boolean>>;

export type OnFailArgs<D> = {
	uniqueColumn?: {
		conflictingColumn: keyof D;
		existingData: D;
	};
	uniqueRow?: {
		existingData: D | null;
	};
	editableColumn?: {
		removedColumns: string[];
		filteredData: D;
	};
	requiredColumn?: {
		missingColumn: keyof D;
	};
};

/**
 * Config types
 */

// Unique Column
export type UniqueColumnConfigOptions = {
	_DO_NOT_USE?: string;
};

export type UniqueColumnConfig<DM extends DMGeneric> = {
	[key in keyof DM]?: ({
		index: keyof Indexes<NamedTableInfo<DM, key>>;
		identifiers?: (keyof NamedTableInfo<DM, key>['document'])[];
	} & UniqueColumnConfigOptions)[];
};

// Unique Row
export type UniqueRowConfigOptions = {
	queryExistingWithNullish?: boolean;
};

export type UniqueRowConfig<DM extends DMGeneric> = {
	[key in keyof DM]?: ({
		index: keyof Indexes<NamedTableInfo<DM, key>>;
		identifiers?: (keyof NamedTableInfo<DM, key>['document'])[];
	} & UniqueRowConfigOptions)[];
};

// Default Values
export type DefaultValuesConfigOptions = {};
export type DefaultValuesConfig<DM extends DMGeneric> = {
	[key in keyof DM]?: {
		[column in keyof WithoutSystemFields<DM[key]['document']>]?: DM[key]['document'][column];
	};
};

export type DefaultValuesColumn<
	DM extends DMGeneric,
	TN extends TableNamesInDataModel<DM>,
> = keyof DefaultValuesConfig<DM>[TN];

// Uneditable and Non-Empty Columns
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

// All configs
export type ConfigOption<DM extends DMGeneric> = UniqueColumnConfig<DM> | UniqueRowConfig<DM>;

export type ConfigOptionsArg<DataModel extends DMGeneric> = {
	uniqueColumns?: UniqueIndexes<DataModel>;
	uniqueRows?: UniqueRowConfig<DataModel>;
	uneditableColumns?: UneditableColumns<DataModel>;
	nonEmptyColumns?: NonEmptyColumns<DataModel>;
	defaultValues: DefaultValuesConfig<DataModel>;
};

/**
 * Unique Indexes helper
 */
export type UniqueIndexes<DM extends DMGeneric> = {
	[key in keyof DM]?: {
		indexes: (keyof Indexes<NamedTableInfo<DM, key>>)[];
		identifiers?: (keyof NamedTableInfo<DM, key>['document'])[];
	};
};
