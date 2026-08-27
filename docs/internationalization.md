# Internationalization

Kino uses Paraglide JS with translation catalogs committed under
`messages/`. Customer-facing UI, transactional email, and Kino-authored
notifications use the same canonical locales:

- `en-US` — English (United States)
- `es-419` — neutral, natural Latin American Spanish
- `zh-Hans` — concise, idiomatic Simplified Chinese

User-generated content is never translated automatically.

## Locale selection

Locale resolution does not alter URLs. The server evaluates these sources in order:

1. The explicit `PARAGLIDE_LOCALE` cookie.
2. Cloudflare's country code, mapped to the closest catalog Kino currently ships.
3. The browser's `Accept-Language` preferences.
4. `en-US`.

All Spanish language variants map to `es-419`, and all Chinese language variants map
to `zh-Hans` until more specific catalogs ship. Unsupported regions and languages fall
back to `en-US`.

Authenticated choices are also stored on the user's profile. The profile preference
is reconciled back into the cookie after sign-in, so it follows the account across
devices. Existing profiles without a stored locale use `en-US` for backend-generated
content until the user makes a choice.

## Adding messages

Add the same message key to all three JSON catalogs. Message functions are generated
under `src/paraglide` and imported from `@/paraglide/messages.js`.

Run:

```sh
pnpm run i18n:check
pnpm run i18n:compile
```

`i18n:check` fails when a production catalog has a missing, extra, or empty key. The
generated directory is ignored and must not be edited manually.

Prefer complete sentences and semantic message names. Do not assemble translated
sentences from fragments. Use Paraglide inputs for interpolation, selectors for
pluralization, and `ParaglideMessage` when translators need to position links or
emphasis.

## Backend-generated content

Emails and notifications must receive an explicit canonical locale. Account-related
messages use the stored profile locale, falling back to `en-US`. Invitation messages
use the inviter's locale. Never depend on request-scoped `getLocale()` inside an
asynchronous backend job.

Legal documents and user-generated content remain outside the translation catalogs
until their dedicated migration phases.
