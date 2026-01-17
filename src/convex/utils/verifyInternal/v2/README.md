# Convex Verify System (v2)

A type-safe validation and transformation system for Convex database operations. This library provides configurable validation plugins that run before `insert` and `patch` operations.

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [verifyConfig](#verifyconfig)
  - [defaultValuesConfig](#defaultvaluesconfig)
  - [uniqueRowConfig](#uniquerowconfig)
  - [uniqueColumnConfig](#uniquecolumnconfig)
- [Writing Custom Plugins](#writing-custom-plugins)
  - [Plugin Interface](#plugin-interface)
  - [Plugin Context](#plugin-context)
  - [Example Plugins](#example-plugins)
- [API Reference](#api-reference)

---

## Quick Start

```ts
import schema from '@convex/schema';

import {
	defaultValuesConfig,
	uniqueColumnConfig,
	uniqueRowConfig,
	verifyConfig,
} from './verifyInternal/v2';

// Create your plugins
const defaultValues = defaultValuesConfig(schema, {
	feedback: {
		status: 'open',
		upvotes: 0,
	},
});

const uniqueRow = uniqueRowConfig(schema, {
	feedback: ['by_projectId_slug'],
});

const uniqueColumn = uniqueColumnConfig(schema, {
	users: ['by_username', 'by_email'],
});

// Combine into verifyConfig
export const { insert, patch } = verifyConfig(schema, {
	// Transform plugin (affects input types)
	defaultValues,
	// Validate plugins (run in order)
	plugins: [uniqueRow, uniqueColumn],
});

// Use in your mutations
export const createFeedback = mutation({
	args: { title: v.string(), projectId: v.id('project') },
	handler: async (ctx, args) => {
		// `status` and `upvotes` are optional - defaults will be applied
		return await insert(ctx, 'feedback', {
			title: args.title,
			projectId: args.projectId,
			slug: generateSlug(),
			// status defaults to 'open'
			// upvotes defaults to 0
		});
	},
});
```

---

## Configuration

### verifyConfig

The main function that combines all plugins and returns typed `insert` and `patch` functions.

```ts
const { insert, patch, configs } = verifyConfig(schema, {
  // Transform plugin (affects input types)
  defaultValues?: DefaultValuesPlugin,

  // Validate plugins (run in order provided)
  plugins?: ValidatePlugin[],
});
```

#### Execution Order

1. **Transform Phase**: `defaultValues` (makes fields optional, applies defaults)
2. **Validate Phase**: `plugins` run in order provided

#### insert

```ts
const id = await insert(ctx, 'tableName', data, {
  onFail?: (args) => void,  // Called before throwing on validation failure
});
```

#### patch

```ts
await patch(ctx, 'tableName', documentId, data, {
  onFail?: (args) => void,
});
```

---

### defaultValuesConfig

A **transform plugin** that makes specified fields optional by providing default values. This is the only built-in plugin that affects TypeScript input types.

```ts
const defaultValues = defaultValuesConfig(schema, {
	tableName: {
		fieldName: defaultValue,
	},
});
```

#### Example

```ts
const defaultValues = defaultValuesConfig(schema, {
	feedback: {
		status: 'open',
		upvotes: 0,
		slug: generateRandomSlug(),
	},
	user: {
		role: 'member',
	},
});
```

With this config, when inserting into `feedback`, the `status`, `upvotes`, and `slug` fields become optional in TypeScript - if omitted, the defaults are applied.

---

### uniqueRowConfig

A **validate plugin** that enforces uniqueness across multiple columns using composite indexes. Add it to the `plugins` array in `verifyConfig`.

```ts
const uniqueRow = uniqueRowConfig(schema, {
	tableName: [
		// Shorthand: just the index name
		'by_column1_column2',

		// Full config: with options
		{
			index: 'by_column1_column2',
			identifiers: ['_id', 'userId'],
			queryExistingWithNullish: false,
		},
	],
});

// Use it
const { insert, patch } = verifyConfig(schema, {
	plugins: [uniqueRow],
});
```

#### Options

| Option                     | Type       | Default   | Description                                                                 |
| -------------------------- | ---------- | --------- | --------------------------------------------------------------------------- |
| `index`                    | `string`   | required  | Name of the composite index to check                                        |
| `identifiers`              | `string[]` | `['_id']` | Fields to check if existing row is the same document (for patch operations) |
| `queryExistingWithNullish` | `boolean`  | `false`   | Whether to query when some index fields are null/undefined                  |

#### Example

```ts
// Shorthand syntax
const uniqueRow = uniqueRowConfig(schema, {
	project: ['by_orgSlug_slug'],
	feedback: ['by_projectId_slug'],
});

// Full config syntax
const uniqueRow = uniqueRowConfig(schema, {
	project: [
		{
			index: 'by_orgSlug_slug',
			identifiers: ['_id'],
		},
	],
});

// Mix and match
const uniqueRow = uniqueRowConfig(schema, {
	project: ['by_orgSlug_slug'],
	feedback: [
		'by_projectId_slug',
		{ index: 'by_projectId_title', identifiers: ['_id', 'authorId'] },
	],
});
```

#### Options

| Option                     | Type       | Default   | Description                                                                 |
| -------------------------- | ---------- | --------- | --------------------------------------------------------------------------- |
| `index`                    | `string`   | required  | Name of the composite index to check                                        |
| `identifiers`              | `string[]` | `['_id']` | Fields to check if existing row is the same document (for patch operations) |
| `queryExistingWithNullish` | `boolean`  | `false`   | Whether to query when some index fields are null/undefined                  |

#### Example

```ts
// Shorthand syntax
const uniqueRow = uniqueRowConfig(schema, {
	project: ['by_orgSlug_slug'],
	feedback: ['by_projectId_slug'],
});

// Full config syntax
const uniqueRow = uniqueRowConfig(schema, {
	project: [
		{
			index: 'by_orgSlug_slug',
			identifiers: ['_id'],
		},
	],
});

// Mix and match
const uniqueRow = uniqueRowConfig(schema, {
	project: ['by_orgSlug_slug'],
	feedback: [
		'by_projectId_slug',
		{ index: 'by_projectId_title', identifiers: ['_id', 'authorId'] },
	],
});
```

---

### uniqueColumnConfig

A **validate plugin** that enforces uniqueness on single columns using single-field indexes. Add it to the `plugins` array in `verifyConfig`.

The column name is derived from the index name by removing the `by_` prefix. For example, `by_username` checks the `username` column.

```ts
const uniqueColumn = uniqueColumnConfig(schema, {
	tableName: [
		// Shorthand: just the index name
		'by_columnName',

		// Full config: with options
		{
			index: 'by_columnName',
			identifiers: ['_id', 'userId'],
		},
	],
});

// Use it
const { insert, patch } = verifyConfig(schema, {
	plugins: [uniqueColumn],
});
```

#### Options

| Option        | Type       | Default   | Description                                          |
| ------------- | ---------- | --------- | ---------------------------------------------------- |
| `index`       | `string`   | required  | Name of the single-field index (e.g., `by_username`) |
| `identifiers` | `string[]` | `['_id']` | Fields to check if existing row is the same document |

#### Example

```ts
// Shorthand syntax
const uniqueColumn = uniqueColumnConfig(schema, {
	users: ['by_username', 'by_email'],
	organizations: ['by_slug'],
});

// Full config syntax
const uniqueColumn = uniqueColumnConfig(schema, {
	users: [
		{ index: 'by_username', identifiers: ['_id', 'clerkId'] },
		{ index: 'by_email', identifiers: ['_id', 'clerkId'] },
	],
});
```

#### Options

| Option        | Type       | Default   | Description                                          |
| ------------- | ---------- | --------- | ---------------------------------------------------- |
| `index`       | `string`   | required  | Name of the single-field index (e.g., `by_username`) |
| `identifiers` | `string[]` | `['_id']` | Fields to check if existing row is the same document |

#### Example

```ts
// Shorthand syntax
const uniqueColumn = uniqueColumnConfig(schema, {
	users: ['by_username', 'by_email'],
	organizations: ['by_slug'],
});

// Full config syntax
const uniqueColumn = uniqueColumnConfig(schema, {
	users: [
		{ index: 'by_username', identifiers: ['_id', 'clerkId'] },
		{ index: 'by_email', identifiers: ['_id', 'clerkId'] },
	],
});
```

---

## Writing Custom Plugins

Validate plugins allow you to add custom validation logic that runs before insert/patch operations.

### Plugin Interface

```ts
interface ValidatePlugin<Type extends string = string, Config = unknown> {
	/** Unique identifier for this plugin */
	readonly _type: Type;

	/** Plugin configuration */
	readonly config: Config;

	/** Verify functions for insert and/or patch operations */
	verify: {
		insert?: (context: ValidateContext, data: any) => Promise<any> | any;
		patch?: (context: ValidateContext, data: any) => Promise<any> | any;
	};
}
```

### Plugin Context

The `ValidateContext` object passed to your verify functions:

```ts
type ValidateContext<TN extends string = string> = {
	/** Full Convex mutation context - use ctx.db for database queries */
	ctx: GenericMutationCtx<any>;

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
```

### Creating a Plugin

Use the `createValidatePlugin` helper for proper typing:

```ts
import { createValidatePlugin } from './verifyInternal/v2';

const myPlugin = createValidatePlugin(
	'myPluginName', // Unique type identifier
	{
		/* config */
	}, // Your plugin's configuration
	{
		insert: async (context, data) => {
			// Validation logic for inserts
			// Throw ConvexError to reject the operation
			// Return data (unchanged) to allow the operation
			return data;
		},
		patch: async (context, data) => {
			// Validation logic for patches
			return data;
		},
	}
);
```

### Example Plugins

#### Logging Plugin

```ts
const loggingPlugin = createValidatePlugin(
	'logging',
	{ enabled: true },
	{
		insert: (context, data) => {
			if (context.config.enabled) {
				console.log(`[${context.tableName}] INSERT:`, data);
			}
			return data;
		},
		patch: (context, data) => {
			if (context.config.enabled) {
				console.log(`[${context.tableName}] PATCH ${context.patchId}:`, data);
			}
			return data;
		},
	}
);
```

#### Required Fields Plugin

```ts
import { ConvexError } from 'convex/values';

const requiredFieldsPlugin = createValidatePlugin(
	'requiredFields',
	{
		feedback: ['title', 'content'],
		user: ['email', 'name'],
	},
	{
		insert: (context, data) => {
			const fields = context.config[context.tableName];
			if (!fields) return data;

			for (const field of fields) {
				if (data[field] === undefined || data[field] === null) {
					context.onFail?.({
						requiredColumn: { missingColumn: field },
					});
					throw new ConvexError({
						message: `Missing required field: ${field}`,
						code: 'REQUIRED_FIELD_MISSING',
					});
				}
			}
			return data;
		},
	}
);
```

#### Ownership Check Plugin (Async)

```ts
const ownershipPlugin = createValidatePlugin(
	'checkOwnership',
	{ ownerField: 'userId' },
	{
		patch: async (context, data) => {
			const { ctx, patchId, config } = context;

			// Get the existing document
			const existing = await ctx.db.get(patchId);
			if (!existing) {
				throw new ConvexError({ message: 'Document not found', code: '404' });
			}

			// Get current user
			const identity = await ctx.auth.getUserIdentity();
			if (!identity) {
				throw new ConvexError({ message: 'Unauthorized', code: '401' });
			}

			// Check ownership
			if (existing[config.ownerField] !== identity.subject) {
				throw new ConvexError({ message: 'Forbidden', code: '403' });
			}

			return data;
		},
	}
);
```

#### Using Index-Based Config Types

For plugins that use index-based configuration (like `uniqueRow` and `uniqueColumn`), you can use the shared types:

```ts
import {
	IndexConfigBaseOptions,
	IndexConfigEntry,
	normalizeIndexConfigEntry,
} from './verifyInternal/v2';

// Define your plugin's specific options
type MyPluginOptions = IndexConfigBaseOptions & {
	customOption?: boolean;
};

// Your config data type
type MyPluginConfigData<DM extends DMGeneric> = {
	[K in keyof DM]?: IndexConfigEntry<DM, K, MyPluginOptions>[];
};

// In your plugin, normalize entries to handle both string and object forms
for (const entry of tableConfig) {
	const normalized = normalizeIndexConfigEntry<MyPluginOptions>(entry);
	// normalized.index - always a string
	// normalized.identifiers - always string[]
	// normalized.customOption - your custom option
}
```

---

## API Reference

### Exports

```ts
// Config functions (plugins)
export { defaultValuesConfig } from './defaultValuesConfig';
export { uniqueColumnConfig } from './uniqueColumnConfig';
export { uniqueRowConfig } from './uniqueRowConfig';

// Main verifyConfig
export { verifyConfig } from './verifyConfig';

// Plugin system
export { createValidatePlugin, isValidatePlugin, runValidatePlugins } from './plugin';
export type { ValidateContext, ValidatePlugin, ValidatePluginRecord } from './plugin';

// Helpers (for advanced usage / plugin authors)
export { constructColumnData, constructIndexData, getTableIndexes } from './helpers';
export { normalizeIndexConfigEntry } from './types';

// Types
export type {
	// Index-based config types (for plugin authors)
	IndexConfigBaseOptions,
	IndexConfigEntry,
	NormalizedIndexConfig,

	// UniqueRow
	UniqueRowConfigData,
	UniqueRowConfigEntry,
	UniqueRowConfigOptions,

	// UniqueColumn
	UniqueColumnConfigData,
	UniqueColumnConfigEntry,
	UniqueColumnConfigOptions,

	// DefaultValues
	DefaultValuesConfigData,

	// OnFail callback types
	OnFailArgs,
	OnFailCallback,

	// Utility types
	MakeOptional,
	Prettify,
} from './types';
```

### OnFailArgs

The `onFail` callback receives details about validation failures:

```ts
type OnFailArgs<D> = {
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
```

---

## Best Practices

1. **Plugin Order Matters**: Plugins run in the order they're listed in the `plugins` array. Put critical validations first.

2. **Always Return Data**: Verify functions must return the data object (unchanged for validate-only plugins).

3. **Use ConvexError**: Throw `ConvexError` for validation failures to provide structured error responses.

4. **Call onFail Before Throwing**: If you want to provide failure details to the caller, invoke `context.onFail?.()` before throwing.

5. **Async is Supported**: Verify functions can be sync or async. All are awaited internally.

6. **Keep Plugins Focused**: Each plugin should do one thing well. Compose multiple plugins for complex validation.
