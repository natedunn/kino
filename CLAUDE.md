# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts Convex backend + Vite dev server on port 3000)
pnpm run dev

# Start only Convex backend or web server
pnpm run dev:convex
pnpm run dev:web

# Build and deploy
pnpm run build           # Vite build only
pnpm run build:deploy    # Deploy Convex, then Vite build
pnpm run deploy          # Build + deploy to Cloudflare Workers

# Type checking and formatting
pnpm run tsc             # TypeScript check (no emit)
pnpm run prettier        # Format with Prettier

# Generate Better Auth schema after modifying auth config
pnpm run db:generate

# Install shadcn components
pnpm run shadcn
```

## Architecture

**Full-stack app**: TanStack Start (React meta-framework) + Convex (serverless backend) + Cloudflare Workers (deployment)

### Frontend (`src/`)

- **Routing**: TanStack Router with file-based routing in `src/routes/`
  - `routeTree.gen.ts` is auto-generated - do not edit
  - Route params use `$` prefix (e.g., `@$org` for `/@{org}`)
- **State/Data**: TanStack Query integrated with Convex via `@convex-dev/react-query`
- **UI**: shadcn components in `src/components/ui/`, Tailwind CSS, Radix primitives
- **Config**: `src/config/` for plans, limits, defaults

### Backend (`src/convex/`)

- **Schema**: Defined with Zod in separate `.schema.ts` files, converted to Convex validators via `zodToConvex`
- **Auth**: Better Auth with Convex adapter (`src/convex/betterAuth/`)
- **File Storage**: Cloudflare R2 integration via `@convex-dev/r2`
- **Utilities**: `src/convex/utils/` for helpers, triggers, context

### Path Aliases

- `@/*` → `src/*`
- `@convex/*` → `src/convex/*`
- `~api` → `src/lib/api.ts`

## Convex Function Conventions

Always use the new function syntax with argument and return validators:

```typescript
import { v } from 'convex/values';

import { query } from './_generated/server';

export const myQuery = query({
	args: { id: v.id('tableName') },
	returns: v.object({
		/* ... */
	}),
	handler: async (ctx, args) => {
		// ...
	},
});
```

- Use `query`/`mutation`/`action` for public functions
- Use `internalQuery`/`internalMutation`/`internalAction` for private functions
- Always include `returns: v.null()` if function returns nothing
- Use `withIndex` instead of `filter` for queries - indexes are required
- Function references: `api.filename.functionName` (public) or `internal.filename.functionName` (private)

## Database Tables

Main tables: `profile`, `project`, `projectMember`, `orgMember`, `feedback`, `feedbackBoard`, `feedbackComment`, `feedbackCommentEmote`

Schema pattern: Zod schemas in `*.schema.ts` files converted via `zodToConvex` helper.

## Key Integrations

- **Authentication**: Better Auth with GitHub OAuth, super admin support
- **File Upload**: R2 storage with signed URLs
- **Search**: Full-text search on feedback via Convex search indexes
