# Website agent guidance

These instructions apply to `website/` and its descendants. Keep website work
scoped here unless the requested change also requires changes elsewhere.

Read and follow [CLEAN_CODE.md](../CLEAN_CODE.md) when writing or changing code.
It defines the shared JavaScript/TypeScript function conventions; continue
following the package-specific rules as well.

## User workflow preferences

- Do not write new tests or modify existing tests unless the user explicitly
  requests it. Feature implementation, bug fixes, and refactors do not imply a
  request to write tests.
- Do not read, inspect, search, tail, or retrieve logs unless the user explicitly
  requests it. This includes browser, application, server, and system logs.

## Project context

- This is the public presentation site for advertisers: a Romanian landing page
  with anchored sections (`#booking`, `#how-it-works`, `#pricing`,
  `#confirmation`, `#content`, `#contact`). It is set up like `../admin/`
  (React, TypeScript, Vite, Oxlint, plain CSS) but is a separate package with its
  own dependencies; never import from `../admin/`. `/login` and `/account` add
  sign-in and read-only account details for all active account roles.
- `@tanstack/react-query`, `@tanstack/react-router`, and `zustand` are installed
  with the same declared version ranges as `admin`. `src/router.tsx` configures
  code-based routes and providers; `src/lib/queryClient.ts` owns server data;
  `src/auth/session.ts` owns the session. The landing page keeps its native
  section anchors and works without a backend or router context in tests.
- `src/lib/api.ts` is the typed fetch client for the backend: base URL from
  `VITE_API_BASE_URL` (development falls back to `http://localhost:3000`), a 15 s
  timeout, `{ error }` messages and a runtime decoder for every response. Login
  uses `POST /users/login`; the protected account page uses `GET /users/me`.
  The landing sections make no API requests. Add calls only for endpoints listed in
  `../backend/README.md`; never invent one. The backend allows this site's origin
  through `WEBSITE_ORIGIN`.
- The landing call to action is a `mailto:` link built in `src/lib/contact.ts` from
  `VITE_CONTACT_EMAIL`; `vite.config.ts` fails a build without it. Do not add
  lead capture until the backend has an endpoint for it. Accounts are created
  by administrators; there is no registration, password reset, profile editing,
  avatar management, credits, files, or campaign booking in this package.
- Session storage uses `camioane.website.session.v1`, separate from admin. Persist
  only the token and expiry. On every session change, abort pending requests,
  clear Query data and remount route content by session revision. Revalidate
  account details on entry, focus and reconnection; a protected 401 signs out.
  Network/server failures allow retry without clearing the session. Never trust
  a saved token or its decoded claims as proof of authentication.
- Railway builds `website/Dockerfile`; follow [Deploying to Railway](README.md#deploying-to-railway)
  for dashboard settings. Declare build-time `VITE_*` variables as `ARG`s in its
  build stage. Keep `Caddyfile`'s cache rules in sync with asset changes: existing
  hashed assets are immutable, HTML uses `no-cache`, and missing files return
  404. Only `/login`, `/account` and their trailing-slash variants rewrite to
  `index.html`. Do not add a catch-all SPA fallback. `/index.html` redirects in
  the client to `/`, retaining its hash.
- Copy comes from `../BUSINESS_PLAN.md`, confirmed rules only. Do not invent
  cities, fleet sizes, rates, credit prices, client names, testimonials or other
  figures. Use the Romanian terms from `DESIGN.md`: mașini, ore-mașină, credite,
  intervale, trasee, materiale publicitare.
- `src/lib/pricing.ts` holds the illustrative pricing example and computes every
  figure the page shows from its rows. Never type a total by hand, and keep the
  "not a price list" labels next to the example.
- Use npm. `package.json` and `package-lock.json` are authoritative; keep them in
  sync. Add dependencies only when the work needs them.

## Commands

Run these commands from `website/`:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the lockfile |
| `npm run dev` | Start Vite on port 5174 |
| `npm run build` | Type-check and produce `dist/` (needs `VITE_CONTACT_EMAIL`) |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the logic and React component tests once |
| `npm run test:watch` | Watch and rerun affected tests |
| `npm run test:coverage` | Run tests with terminal and HTML coverage reports |
| `npm run preview` | Preview the production build on port 5174 |

Tests live in `tests/` and use Vitest, jsdom, and React Testing Library, configured
separately in `vitest.config.ts`. Use explicit test imports, accessible queries,
and focused behavioral assertions. Mock network and clipboard access; do not
require a running backend or read real environment values. Account for
module-load environment and capability checks before importing the target.
Shared setup restores DOM, mocks, timers, environment overrides, and clipboard
state. Coverage is informational, includes untested application modules, and
excludes declarations and the bootstrap entry point. Do not report tests as
passing when only the build and lint checks were run.

## Code conventions

- Two-space indentation, single quotes, no semicolons, `import type` for
  type-only imports, relative imports only. Function components with hooks;
  `.tsx` for JSX, `.ts` otherwise. Keep `erasableSyntaxOnly` and the unused-code
  checks; do not weaken compiler checks.
- `src/sections/` holds landing sections; `src/pages/<PageName>/` holds account
  pages; `src/auth/` holds session state and Romanian authentication feedback.
  `src/components/` holds shared pieces; `src/lib/` holds formatting, pricing,
  contact, user types, the API client and the Query client.
- Use TanStack Query for server data and caching when adding API-backed features;
  query and mutation functions should call `src/lib/api.ts`. Keep server data
  in the Query cache rather than duplicating it in Zustand.
- Use Zustand for shared client state when needed. Keep component-local state
  in React; do not introduce a global store solely because Zustand is installed.
- Add page routes in `src/router.tsx`. Keep the landing `App` independently
  renderable and preserve its native links. Account pages use Router links;
  local form and clipboard state stay in React.
- Tokens and primitives in `src/index.css` are copied from
  `../admin/src/index.css` and `App.css`. When a shared token changes in
  `../DESIGN.md`, change it in `src/index.css` and in the token table of
  `DESIGN.md` too. Page layout lives in `src/App.css`.

## UI and verification

- Follow `DESIGN.md` in this folder; the shared tokens come from `../DESIGN.md`.
  Update `DESIGN.md` in the same commit when you add or change a token, size or
  pattern here.
- Use semantic elements, visible keyboard focus and layouts that work on narrow
  screens; the page never scrolls sideways. Keep one primary button on the page.
- After changing code, tests, dependencies or build configuration, run `npm test`, `npm run lint`
  and `npm run build` (with `VITE_CONTACT_EMAIL` set). When a browser is
  available, check the page at 1440, 768 and 390px wide.
