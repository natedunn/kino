# Analytics

Kino uses PostHog for production product analytics, session replay, feature
flags, and frontend/client-surfaced error tracking. Analytics should answer a
clear product or reliability question; it should not mirror every UI action.

## When to Track

Good candidates:

- A user completes onboarding or setup.
- A user creates, updates, publishes, archives, or deletes a core resource.
- A user connects, disconnects, or refreshes an integration.
- A user uses a new feature where adoption matters.
- A user hits a meaningful failure state that is visible in the product.

Do not track:

- Every click, hover, keystroke, or form field change.
- Raw text input, editor content, comments, feedback descriptions, or file names.
- Access tokens, secrets, invite codes, OAuth state, or webhook payloads.
- Full URLs that may contain private slugs, IDs, tokens, or search params.
- Events just because code changed.

## Event Shape

- Use lowercase snake_case names.
- Prefer past-tense product events, such as `feedback_created` or
  `github_repository_connected`.
- Keep properties small, stable, and non-sensitive.
- Prefer booleans, enums, and coarse counts over free-form strings.
- Include IDs only when they are internal opaque IDs and useful for debugging;
  do not include user-generated slugs or names unless explicitly needed.

## Implementation

- Use the shared PostHog helper layer in `src/lib/posthog.tsx`; do not call the
  PostHog SDK directly from feature components unless the helper cannot support
  the event shape.
- Keep analytics production-only. Do not add local, preview, or test-only
  tracking paths.
- If adding a new event from a mutation/query error path, avoid sending args,
  mutation variables, query hashes, form values, or user-generated content.
- Autocapture is disabled intentionally. Add explicit events only when they are
  useful and safe.
