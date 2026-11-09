# Frontend agent guidance

These instructions apply to `frontend/` and its descendants. Keep frontend work
scoped here unless the requested feature also requires changes elsewhere.

## User workflow preferences

- Do not write new tests or modify existing tests unless the user explicitly
  requests it. Feature implementation, bug fixes, and refactors do not imply a
  request to write tests.
- Do not read, inspect, search, tail, or retrieve logs unless the user explicitly
  requests it. This includes browser, application, server, container, and system
  logs.

## Project context

- This is the Camioane App admin dashboard frontend, built with React,
  TypeScript, and Vite. Design its pages, navigation, and features for
  administrators and their management workflows.
- Use npm. Keep `package.json` and `package-lock.json` in sync when dependencies change.
- `package.json` and the lockfile are authoritative for installed versions.
- Zustand owns session state, TanStack Query owns API data and mutations, and
  TanStack Router handles login, users, and access-denied navigation. The Users
  page uses a semantic table; TanStack Table remains available but unconfigured.
- The Users page and form live under `src/pages/UsersPage/`; shared types,
  validation, API client and query client live under `src/lib/`.
- Cars live under `src/pages/CarsPage/` (admin-only at `/cars`) and use the real
  `/cars` API. Shared types, limits, normalization and query keys live in
  `src/lib/car.ts`; validation, search and status presentation remain page-local.
  Keep every car query under `carsKey(revision)` and route 403s through
  `handleAdminError`. Editors own a separate snapshot and submit its version;
  conflicts retain entered values until an explicit Reload car replaces them.
  Saves clear filters and deletion uses a native confirmation dialog. Pending
  submissions disable repeated actions and dialog dismissal. Driver names remain
  optional text and routes are five fixed labels, independent of the route builder.
  The complete inventory is filtered locally, IDs survive plate changes, and
  status is administrative rather than connectivity. The dashboard still uses
  its separate sample fleet; never seed fictional cars into the database.
- The Files page lives under `src/pages/FilesPage/` (admin-only at `/files`) and
  uses the real `/files` API. Uploads go through the XHR path in `src/lib/api.ts`
  so they can report progress; keep its session, abort and 401 handling aligned
  with `request`. `src/lib/format.ts` holds the formatting shared between pages.
  `UploadProgress` lives in `src/components/` because the video editor uses it too.
- The video editor lives under `src/pages/VideoEditorPage/` (admin-only at
  `/files/$fileId/edit`, lazy-loaded). Keep the segment model and its history in
  `edit.ts` as pure functions. `@xzdarcy/react-timeline-editor` only draws and
  reports drags; the page owns the edit, and the `<video>` element drives playback.
  Export renders in the browser through mediabunny (`renderVideo.ts`, loaded with a
  dynamic import) and uploads a new file with `api.uploadFile`; the backend has no
  edit, replace or single-file endpoint. Check the library's behaviour in its
  `src/` before working around it: bars keep their own position state, and the
  ruler caches tick cells per zoom.
- The Profile page lives under `src/pages/ProfilePage/` (`/profile`, every role)
  and sets or removes the signed-in account's picture. `AvatarEditor` in
  `src/components/` does the work and is also used by the Users edit form, where
  admins change anyone's picture; it saves straight away through
  `api.uploadAvatar` (`PUT`, the XHR upload path) and `api.deleteAvatar`, then
  writes the returned user into every cache with `replaceCachedUser`
  (`src/auth/currentUser.ts`). `Avatar` shows a picture with the bearer token
  through an object URL, keyed on `avatar.updatedAt`, and falls back to the
  email's initial. Users carry `avatar: { url, updatedAt } | null`; the decoder
  accepts only the user's own `/users/<id>/avatar` URL.
- The Credits page lives under `src/pages/CreditsPage/` (admin-only at `/credits`)
  and uses the real `/credits` API through the typed calls in `src/lib/api.ts`;
  credit types, labels and limits live in `src/lib/credit.ts`. Keep every credits
  query under `creditsKey(revision)` so one invalidation refreshes the page after an
  action, and send 403s from its mutations through `handleAdminError`. The API has
  no list of every account's balance; read one account at a time.
- The admin dashboard lives under `src/pages/DashboardPage/` and runs on the
  invented rows in `sampleData.ts` until fleet, booking, creative and playback
  APIs exist. Its actions change local state only. Compute figures in
  `dashboardData.ts` from rows; never type a total by hand.
- Campaigns live under `src/pages/CampaignPage/` (admin-only at `/campaign`) and
  use `/campaigns` to save shared drafts. Query keys start with `campaignsKey(revision)`;
  an open editor owns a separate snapshot and submits its version to prevent lost
  updates. Past Europe/Bucharest dates and hours are read-only. Saving does not
  launch campaigns or charge credits. Shared API types live in `src/lib/campaign.ts`;
  calendar and unfinished-form helpers remain page-local.
- Route Builder at `/routes` saves shared administrator routes through `/routes`.
  Shared types/limits/query keys live in `src/lib/route.ts`; page-local
  `useRouteEditor` owns persistence and the independent editor snapshot.
  Use `routesKey(revision)` and `handleAdminError`. Updates submit the loaded
  version; conflicts keep edits until explicit reload. Names and 2–100 stops are
  saved independently of map/routing availability; geometry is recalculated.
  Retain legacy waypoint-only tab drafts and user isolation. Pending persistence
  disables map gestures and edits. Cars' fixed route labels remain separate.
- Role values are ADMIN, OPERATOR, DRIVER, and USER. Reuse the role list,
  validation guard, and labels in `src/lib/user.ts`. Only a verified, currently
  valid ADMIN role grants management access; preserve denial for other roles.
  `src/auth/adminAccess.ts` owns the shared admin-access/users query and denial
  handling. Use its context for route guards, navigation, and the Users table;
  do not infer access from the assigned role alone. A 403 clears cached users
  without ending the session. Recheck on navigation, focus, reconnect, or retry;
  no polling or role-management API exists.
- Authentication lives under `src/auth/`. Only token/expiry persist under
  `camioane.session.v1`. Always validate restored sessions with the API, cancel
  requests and clear private cache on session changes, and preserve cross-tab logout.
  Never read, migrate, or overwrite the old `camioane.users-demo.v1` data.
- Styling currently uses plain CSS. No component or form library is configured.
  Frontend tests use Vitest, jsdom, and React Testing Library under `tests/`.
- The Express API lives in `../backend/`. Read its source and README when connecting
  a feature to the API; do not invent endpoints or response contracts.

## Commands

Run these commands from `frontend/` with Node.js 24+:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the project lockfile on a fresh checkout |
| `npm install <package>` | Add a runtime dependency and update the lockfile |
| `npm install -D <package>` | Add development tooling and update the lockfile |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run the TypeScript build check and produce `dist/` |
| `npm run lint` | Run Oxlint using `.oxlintrc.json` |
| `npm test` | Run the complete isolated frontend test suite once |
| `npm run test:watch` | Watch and rerun affected tests during development |
| `npm run test:coverage` | Run tests and write informational V8 coverage to `coverage/` |
| `npm run preview` | Preview an existing production build locally |

The production build also type-checks tests through `tsconfig.test.json`. For a
build without a local API configuration, use
`VITE_API_BASE_URL=https://api.example.test npm run build`. Do not report tests as
passing when only the build and lint checks were run.

## Testing conventions

- The user's explicit-test-request preference above still applies. Keep requested
  tests in `tests/*.test.ts` or `tests/*.test.tsx`, with shared helpers in
  `tests/helpers/`. Prefer accessible roles, labels and `user-event`, asserting
  visible outcomes and submitted data over component internals or snapshots.
- `vitest.config.ts` is separate from the production Vite config. It disables
  environment-file loading, provides synthetic `.example.test` service URLs and
  runs in Europe/Bucharest. Tests must need no backend, database, credentials or
  external network. Unexpected fetch/XHR requests fail the test even if caught.
- Reuse typed fixtures, controlled responses and deferred promises. Component
  tests can mock typed `api` methods; transport tests use `respond`/`TestXHR` to
  verify the real API client. Mock map/routing, media and encoding boundaries;
  retain the real editing and persistence logic.
- `renderPage` supplies an in-memory router, the existing query client and auth
  contexts. Guard tests exercise the real `Authenticated` provider. Use
  `authenticate` to seed a session for isolated management-page tests.
- Shared setup clears DOM, storage, queries, session state and notifications and
  restores clocks, browser stubs and spies. Components must clean up their own
  listeners and requests. Register teardown for manually started subscriptions
  with `onTestFinished`, including on assertion failures. Keep fake-clock cases
  synchronous or fake only the clocks needed; simulated media/pointer events are
  appropriate where jsdom or fake timers cannot drive real browser behavior.
- Keep import-time session restoration in `session-initialization.test.ts`.
  Do not reset the module graph inside component tests: React and store imports
  must keep the same identity. Freeze dates for calendar tests, including
  Bucharest midnight and both daylight-saving transitions.
- Coverage includes all `src/` TypeScript/TSX modules, excluding declarations and
  `main.tsx`, with no minimum threshold. Unexecuted map, timeline and encoding
  integrations remain visible in the report. Coverage is not proof of layout,
  native focus trapping, actual playback/encoding, or external-service behavior;
  these still need browser checks. Keep `coverage/` and other generated output
  untracked. Report production defects separately instead of relaxing assertions.

## Code conventions

- Use TypeScript and function components with hooks. Use `.tsx` for JSX and `.ts`
  for modules without JSX.
- Match surrounding formatting: two-space indentation, single quotes, and no
  semicolons. Use `import type` for imports used only as types.
- Type component props and API boundaries; let TypeScript infer straightforward
  local values. Avoid `any` and unnecessary type assertions.
- Follow the existing TypeScript configuration, including `erasableSyntaxOnly`
  and unused-code checks. Do not weaken checks to make a change compile.
- Use relative imports while no path alias is configured. Keep TypeScript and
  Vite resolution aligned if an alias is introduced.
- `src/main.tsx` is the entry point, `src/App.tsx` configures routes and providers,
  and `src/index.css` contains global styles. Add folders as features need them.
- Keep effects for synchronization with external systems; derive values directly
  when they can be calculated from props or state.

## Page and component structure

- When building or extending a page or feature, reuse suitable existing
  components before creating new ones.
- Extract a UI section into a component when it is repeated within the same
  page, or when its size or complexity makes a separate component easier to
  understand and maintain. Give each extracted component a clear responsibility;
  use meaningful boundaries rather than a fixed line-count limit.
- Keep components used by only one page alongside that page, for example in
  `src/pages/<PageName>/components/`. A component can belong here even when it is
  rendered multiple times on that page.
- Put components used by multiple pages in `src/components/`. Move a page-local
  component there when another page needs it, and update its imports. Base shared
  placement on actual reuse rather than possible future reuse.
- Keep small, straightforward UI used only once inline in its parent. Avoid
  splitting trivial markup into components when it adds no clarity or reuse.

## State, routing, and data

- Use React state for component-local interaction and Zustand for client state
  that needs to be shared across components. Select only the store
  values a component needs.
- Use TanStack Query for API data, caching, and mutations. Avoid copying its
  cached server data into Zustand. Include request parameters in query keys and
  update or invalidate affected queries after successful mutations.
- Use the existing code-based TanStack Router tree for application navigation;
  file-route generation is not configured.
- Use TanStack Table for table behavior where needed. Verify APIs against the
  installed major version before using examples from another version.
- Reuse existing integrations as they develop. Keep the router and query client
  stable across renders, and handle loading, empty, and error states in data views.
- Keep API calls in reusable typed modules or hooks. Check HTTP failures and
  propagate useful errors. Keep database access and private credentials in the
  backend; browser configuration, including `VITE_*` variables, is public.
- `VITE_API_BASE_URL` defaults to localhost:3000 only in development; production
  builds require an explicit value. Dev and preview use port 5173 with strict
  port selection. Match the backend CORS origin when changing frontend hosting.

## UI and verification

- Follow [DESIGN.md](DESIGN.md) for frontend tokens, type, layout, components and
  data formatting. Update it when you add or change one. Keep
  [../DESIGN.md](../DESIGN.md) as the shared brand and cross-platform design
  reference, and update it when shared rules change.
- Use semantic elements, labeled controls, visible keyboard focus, and layouts
  that work on narrow screens. Verify changed interactions in a browser when one
  is available.
- Add dependencies when the requested work needs them. Reuse the installed stack
  and avoid introducing overlapping libraries without a concrete reason.
- After changing application code, dependencies, or build configuration, run
  `npm run build` and `npm run lint`. Report any failures or checks not run.
- For documentation-only changes, review the content and check whitespace;
  rebuilding the application is unnecessary.
- For requested test changes, run the affected tests during development, then
  `npm test`, `npm run test:coverage`, `npm run lint`, and `npm run build`.
  Keep generated output and `node_modules/` out of commits.
