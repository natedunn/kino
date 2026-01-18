# convex-verify

Type-safe verification and validation for Convex database operations.

## Features

- **Type-safe insert/patch** - Full TypeScript inference for your schema
- **Default values** - Make fields optional in `insert()` with automatic defaults
- **Protected columns** - Prevent accidental updates to critical fields in `patch()`
- **Validation plugins** - Unique row/column enforcement, custom validators
- **Extensible** - Create your own validation plugins

## Installation

```bash
npm install convex-verify
```

**Peer Dependencies:**

- `convex` >= 1.17.4

## Quick Start

```ts
import {
	defaultValuesConfig,
	protectedColumnsConfig,
	uniqueColumnConfig,
	uniqueRowConfig,
	verifyConfig,
} from 'convex-verify';

import schema from './schema';

export const { insert, patch, dangerouslyPatch } = verifyConfig(schema, {
	// Make fields optional with defaults
	defaultValues: defaultValuesConfig(schema, () => ({
		posts: { status: 'draft', views: 0 },
	})),

	// Prevent patching critical fields
	protectedColumns: protectedColumnsConfig(schema, {
		posts: ['authorId'],
	}),

	// Validation plugins
	plugins: [
		uniqueRowConfig(schema, {
			posts: ['by_author_slug'],
		}),
		uniqueColumnConfig(schema, {
			users: ['by_email', 'by_username'],
		}),
	],
});
```

Then use in your mutations:

```ts
import { insert, patch } from './verify';

export const createPost = mutation({
	args: { title: v.string(), content: v.string() },
	handler: async (ctx, args) => {
		// status and views are optional - defaults are applied
		return await insert(ctx, 'posts', {
			title: args.title,
			content: args.content,
			authorId: ctx.auth.userId,
		});
	},
});

export const updatePost = mutation({
	args: { id: v.id('posts'), title: v.string() },
	handler: async (ctx, args) => {
		// authorId is protected - TypeScript won't allow it here
		await patch(ctx, 'posts', args.id, {
			title: args.title,
		});
	},
});
```

---

## API Reference

### `verifyConfig(schema, config)`

Main configuration function that returns typed `insert`, `patch`, and `dangerouslyPatch` functions.

```ts
const { insert, patch, dangerouslyPatch, configs } = verifyConfig(schema, {
  defaultValues?: DefaultValuesConfig,
  protectedColumns?: ProtectedColumnsConfig,
  plugins?: ValidatePlugin[],
});
```

#### Returns

| Function           | Description                                                                         |
| ------------------ | ----------------------------------------------------------------------------------- |
| `insert`           | Insert with default values applied and validation plugins run                       |
| `patch`            | Patch with protected columns removed from type and validation plugins run           |
| `dangerouslyPatch` | Patch with full access to all columns (bypasses protected columns type restriction) |
| `configs`          | The original config object (for debugging)                                          |

---

## Transforms

Transforms modify the input type of `insert()`.

### `defaultValuesConfig(schema, config)`

Makes specified fields optional in `insert()` by providing default values.

```ts
import { defaultValuesConfig } from 'convex-verify';
// or
import { defaultValuesConfig } from 'convex-verify/transforms';
```

#### Static Config

```ts
const defaults = defaultValuesConfig(schema, {
	posts: { status: 'draft', views: 0 },
	comments: { likes: 0 },
});
```

#### Dynamic Config (Fresh Values)

Use a function for values that should be generated fresh on each insert:

```ts
const defaults = defaultValuesConfig(schema, () => ({
	posts: {
		status: 'draft',
		slug: generateRandomSlug(),
		createdAt: Date.now(),
	},
}));
```

#### Async Config

```ts
const defaults = defaultValuesConfig(schema, async () => ({
	posts: {
		category: await fetchDefaultCategory(),
	},
}));
```

---

## Configs

Configs modify the input type of `patch()`.

### `protectedColumnsConfig(schema, config)`

Removes specified columns from the `patch()` input type, preventing accidental updates.

```ts
import { protectedColumnsConfig } from 'convex-verify';
// or
import { protectedColumnsConfig } from 'convex-verify/configs';
```

#### Example

```ts
const protected = protectedColumnsConfig(schema, {
	posts: ['authorId', 'createdAt'],
	comments: ['postId', 'authorId'],
});
```

#### Bypassing Protection

Use `dangerouslyPatch()` when you need to update protected columns:

```ts
// Regular patch - authorId not allowed
await patch(ctx, 'posts', id, {
	authorId: newAuthorId, // ❌ TypeScript error
	title: 'New Title', // ✅ OK
});

// Dangerous patch - full access
await dangerouslyPatch(ctx, 'posts', id, {
	authorId: newAuthorId, // ✅ OK (bypasses protection)
	title: 'New Title',
});
```

**Note:** `dangerouslyPatch()` still runs validation plugins - only the type restriction is bypassed.

---

## Plugins

Plugins validate data during `insert()` and `patch()` operations. They run after transforms and can throw errors to prevent the operation.

### `uniqueRowConfig(schema, config)`

Enforces uniqueness across multiple columns using composite indexes.

```ts
import { uniqueRowConfig } from 'convex-verify';
// or
import { uniqueRowConfig } from 'convex-verify/plugins';
```

#### Shorthand (Index Names)

```ts
const uniqueRows = uniqueRowConfig(schema, {
	posts: ['by_author_slug'], // Unique author + slug combo
	projects: ['by_org_slug'], // Unique org + slug combo
});
```

#### With Options

```ts
const uniqueRows = uniqueRowConfig(schema, {
	posts: [
		{
			index: 'by_author_slug',
			identifiers: ['_id', 'authorId'], // Fields to check for "same document"
		},
	],
});
```

### `uniqueColumnConfig(schema, config)`

Enforces uniqueness on single columns using indexes.

```ts
import { uniqueColumnConfig } from 'convex-verify';
// or
import { uniqueColumnConfig } from 'convex-verify/plugins';
```

The column name is derived from the index name by removing `by_` prefix:

- `by_username` → checks `username` column
- `by_email` → checks `email` column

#### Example

```ts
const uniqueColumns = uniqueColumnConfig(schema, {
	users: ['by_username', 'by_email'],
	organizations: ['by_slug'],
});
```

#### With Options

```ts
const uniqueColumns = uniqueColumnConfig(schema, {
	users: [
		'by_username', // shorthand
		{ index: 'by_email', identifiers: ['_id', 'clerkId'] }, // with options
	],
});
```

### `createValidatePlugin(name, config, handlers)`

Create custom validation plugins.

```ts
import { createValidatePlugin } from 'convex-verify';
// or
import { createValidatePlugin } from 'convex-verify/core';
```

#### Example: Required Fields Plugin

```ts
const requiredFields = createValidatePlugin(
	'requiredFields',
	{ fields: ['title', 'content'] },
	{
		insert: (context, data) => {
			for (const field of context.config.fields) {
				if (!data[field]) {
					throw new ConvexError({ message: `Missing required field: ${field}` });
				}
			}
			return data;
		},
	}
);
```

#### Example: Async Validation

```ts
const checkOwnership = createValidatePlugin(
	'checkOwnership',
	{},
	{
		patch: async (context, data) => {
			const existing = await context.ctx.db.get(context.patchId);
			const user = await getCurrentUser(context.ctx);

			if (existing?.authorId !== user._id) {
				throw new ConvexError({ message: 'Not authorized to edit this document' });
			}
			return data;
		},
	}
);
```

#### Plugin Context

Plugins receive a `ValidateContext` object:

```ts
type ValidateContext = {
	ctx: GenericMutationCtx; // Convex mutation context
	tableName: string; // Table being operated on
	operation: 'insert' | 'patch';
	patchId?: GenericId; // Document ID (patch only)
	onFail?: OnFailCallback; // Callback for failure details
	schema?: SchemaDefinition; // Schema reference
};
```

---

## Subpath Imports

For smaller bundle sizes, you can import from specific subpaths:

```ts
// Import everything from root
import { uniqueRowConfig, verifyConfig } from 'convex-verify';
import { protectedColumnsConfig } from 'convex-verify/configs';
// Or import from specific subpaths
import { createValidatePlugin, verifyConfig } from 'convex-verify/core';
import { uniqueColumnConfig, uniqueRowConfig } from 'convex-verify/plugins';
import { defaultValuesConfig } from 'convex-verify/transforms';
import { getTableIndexes } from 'convex-verify/utils';
```

---

## Error Handling

### `onFail` Callback

All operations accept an optional `onFail` callback for handling validation failures:

```ts
await insert(ctx, 'posts', data, {
	onFail: (args) => {
		if (args.uniqueRow) {
			console.log('Duplicate row:', args.uniqueRow.existingData);
		}
		if (args.uniqueColumn) {
			console.log('Duplicate column:', args.uniqueColumn.conflictingColumn);
		}
	},
});
```

### Error Types

Validation plugins throw `ConvexError` with specific codes:

- `UNIQUE_ROW_VERIFICATION_ERROR` - Duplicate row detected
- `UNIQUE_COLUMN_VERIFICATION_ERROR` - Duplicate column value detected

---

## TypeScript

This library is written in TypeScript and provides full type inference:

- `insert()` types reflect optional fields from `defaultValues`
- `patch()` types exclude protected columns
- Plugin configs are type-checked against your schema
- Index names are validated against your schema's indexes

---

## License

MIT
