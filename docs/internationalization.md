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

## Required feature workflow

Every new or changed customer-facing feature must complete localization in the same
pull request. Agents and contributors should:

1. Inventory all visible and assistive copy: headings, labels, buttons, menus,
   placeholders, empty/loading states, dialogs, toasts, validation, errors, email,
   notifications, page titles, `aria-label`s, and screen-reader-only text.
2. Add semantic keys to `messages/en-US.json`, `messages/es-419.json`, and
   `messages/zh-Hans.json`. Do not add English literals as temporary UI copy.
3. Translate the intended meaning and action, not the English words mechanically.
   Keep the voice concise, direct, and natural for each locale.
4. Keep values separate from labels in controls. Stable identifiers and enum values
   stay language-neutral; only the displayed label is translated.
5. Route expected server failures through the structured application-error contract
   in `convex/shared/app-errors.ts` and `convex/lib/app-error.ts`. Decode them with
   `localizeError`; do not surface `error.message` or Convex framing directly.
6. Use locale-aware date, time, number, currency, and plural formatting. Never
   hard-code `en-US` formatting in customer-facing code.
7. Run `pnpm run i18n:check`, `pnpm run i18n:compile`, and the relevant tests. Before
   updating a pull request, run `pnpm run verify:pr` as required by `AGENTS.md`.
8. Manually check Spanish and Chinese at narrow and wide viewport sizes. Exercise
   error, empty, loading, and signed-out states—not only the happy path.

User-generated names and content remain unchanged in every locale. Internal logs,
debug messages, admin tools, the UI lab, and explicitly temporary placeholder pages
do not enter the production catalogs unless their scope changes.

## Translation and terminology policy

Natural usage wins over literal translation. Translate ordinary interface language
by default; retain an English term only when it is a product or protocol name, a
widely recognized technical token, or the English term is materially clearer to the
target audience. Once chosen, use the same term throughout the product.

For `es-419`, use conversational, region-neutral Latin American Spanish and avoid
Spain-specific vocabulary. Prefer short everyday words over formal calques. Current
terminology decisions:

| Concept                                         | `es-419` term               | Reason                                                                                |
| ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Kino Feedback item/area                         | `feedback` / `Feedback`     | Common product-team term and keeps the entity distinct from its nested `comentarios`. |
| A comment on feedback or an update              | `comentario`                | Ordinary Spanish; never use it as the Feedback entity name.                           |
| URL slug                                        | `identificador URL`         | Clear to non-developers; `slug` is implementation jargon.                             |
| roadmap                                         | `hoja de ruta`              | Established, understandable Spanish.                                                  |
| dashboard                                       | `panel`                     | Familiar interface term.                                                              |
| settings                                        | `configuración`             | Standard interface term.                                                              |
| GitHub App / GitHub Issues / GitHub Discussions | Keep official product names | Proper feature names used by GitHub.                                                  |
| API, URL, JSON, CSV, OAuth, Markdown            | Keep the technical token    | Recognized standards or formats. Explain only when the surrounding audience needs it. |
| avatar                                          | `avatar`                    | Established Spanish usage.                                                            |

Do not assume that common developer jargon is common to customers. When introducing
a disputed loanword, check an authoritative language reference and established UI
usage, record the decision in this table, and review the whole catalog for consistency.
Useful references include the
[Microsoft Spanish localization style guides](https://learn.microsoft.com/globalization/reference/microsoft-style-guides),
[Microsoft internationalization guidance](https://learn.microsoft.com/globalization/methodology/software-internationalization),
[FundéuRAE terminology recommendations](https://www.fundeu.es/recomendacion/feedback-en-espanol-respuesta-reaccionesimpresiones-retorno-932/),
and the localized documentation for third-party product names such as
[GitHub Apps](https://docs.github.com/es/apps/using-github-apps).

## Backend-generated content

Emails and notifications must receive an explicit canonical locale. Account-related
messages use the stored profile locale, falling back to `en-US`. Invitation messages
use the inviter's locale. Never depend on request-scoped `getLocale()` inside an
asynchronous backend job.

Legal documents and user-generated content remain outside the translation catalogs
until their dedicated migration phases.
