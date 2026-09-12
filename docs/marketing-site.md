# Marketing site, footer, and brand

This documents the public (signed-out) surface of Kino: the landing page,
the marketing pages, the site footer, and the brand lockup. Most of it is
scaffolding with real design and real links where we have them, and clearly
marked placeholders where we don't. The point is to be able to fill things
in without touching layout code.

## Where things live

| Concern                              | Location                                                  |
| ------------------------------------ | --------------------------------------------------------- |
| Link registry (footer + socials)     | `src/lib/site-links.ts`                                   |
| Page frame (nav + content + footer)  | `src/components/app-shell.tsx`                            |
| Footer                               | `src/components/site-footer.tsx`                          |
| Brand lockup / `Kino™` name          | `src/components/kino-brand.tsx`                           |
| Social icons (monochrome)            | `src/components/social-icons.tsx`                         |
| Marketing page scaffolding           | `src/components/marketing/marketing-page.tsx`             |
| Marketing layout (nav + full footer) | `src/routes/_marketing/route.tsx`                         |
| Pages                                | `src/routes/_marketing/{about,pricing,contact,brand}.tsx` |

### Page frame

Every route layout renders through `<AppShell>` (pass `nav` only for a custom header).
The nav is passed in because `MainNav` needs per-route context; the footer is
rendered by the shell so no page can forget it. Only the auth card pages and
the `/ui` component lab are intentionally outside the shell.

### Footer

One footer, everywhere except the auth pages: brand block, four link columns,
social row, development pill, copyright and trademark small print, language
selector, theme toggle, and a wordmark watermark along the bottom edge.

### Adding or activating a link

Edit `FOOTER_GROUPS` / `SOCIAL_LINKS` in
`src/lib/site-links.ts`.

- `{ kind: 'soon' }` renders a muted label with a “Soon” tag.
- `{ kind: 'internal', to }` must be a route in `SiteInternalTo`; add the route
  string there first so the footer stays typed against the route tree.
- `{ kind: 'external', href }` opens in a new tab.
- A social entry with `href: null` renders as a disabled icon. Fill in the URL
  to go live.

Footer labels are localized (`footer_*` keys in `messages/*.json`). Social
network names are brand names and are not translated.

## Trademark

The product name is written **Kino™** when it appears as a brand (footer
lockup, brand page, legal small print). Use `<KinoName />` for that; in
running prose use plain “Kino”. The main nav intentionally shows the mark
only. A previous commit removed ™ from page headers; this pass reintroduces
it deliberately in the brand lockup and small print only.

The trademark line (“Kino™ and the Kino mark are trademarks of Kino.”) is a
common-law ™ claim. Update it if the operating entity changes (see the scope
paragraph in the privacy policy) or if the mark is registered (®).

## Placeholder inventory

Everything below is visibly marked "Soon" or disabled in the UI and lives
in `site-links.ts` or the page files. Nothing needs a layout change to go
live.

| Item                      | Where                     | What's needed                                                                                                                              |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| X profile                 | `SOCIAL_LINKS`            | Create the account, set `href`.                                                                                                            |
| Bluesky profile           | `SOCIAL_LINKS`            | Create the account, set `href`.                                                                                                            |
| Discord server            | `SOCIAL_LINKS`            | Create the server and a permanent invite, set `href`.                                                                                      |
| Documentation             | `FOOTER_GROUPS.resources` | No docs site yet. `/docs` currently holds legal notices + stack.                                                                           |
| Status page               | `FOOTER_GROUPS.resources` | Pick a status provider, link it.                                                                                                           |
| Terms of service          | `FOOTER_GROUPS.legal`     | Not written. Add `src/routes/docs/terms.tsx` + docs-shell nav.                                                                             |
| Private contact inbox     | `/contact`                | The in-product private channel promised by `LegalContact`.                                                                                 |
| Security disclosure route | `/contact`                | Stand up a private security inbox.                                                                                                         |
| Pricing page              | `/pricing`                | Orphaned: reachable by URL, footer shows Soon. Paid prices and limits are placeholders; upcoming rows sit behind `SHOW_UPCOMING_FEATURES`. |
| Brand asset downloads     | `/brand`                  | Export SVG/PNG mark + lockup, press kit; wire the button.                                                                                  |
| Legal mailing address     | legal pages               | Required before publishing notices (see `LegalContact`).                                                                                   |

## Positioning

The marketing surface makes no open-source claim. Do not reintroduce
"open source", "view source", or self-hosting language until that decision is
made.

GitHub is where the code is hosted, and the GitHub links (footer Resources,
social row) stay. It is never where we send people for issues, feedback, or
announcements. Feedback, the roadmap, and release notes for Kino live on
Kino's own project at `@natedunn/kino` (`KINO_PROJECT` in `site-links.ts`,
rendered through `<KinoProjectLink>`). That org and project must exist in
every environment, including previews and local seeds, or the footer and
contact page link to a 404.

## Localization status

The footer is fully localized. Marketing page copy (`/about`, `/pricing`,
`/contact`, `/brand`) is English-only, the same deliberate deferral as the
landing page and legal documents (see `docs/internationalization.md`,
"explicitly temporary placeholder pages"). When the copy is finalized, move
it into the catalogs in the same PR.
