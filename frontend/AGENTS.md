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
- The admin dashboard lives under `src/pages/DashboardPage/` and runs on the
  invented rows in `sampleData.ts` until fleet, booking, creative and playback
  APIs exist. Its actions change local state only. Compute figures in
  `dashboardData.ts` from rows; never type a total by hand.
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
- Styling currently uses plain CSS. No component library, form library, or test
  runner is configured.
- The Express API lives in `../backend/`. Read its source and README when connecting
  a feature to the API; do not invent endpoints or response contracts.

## Commands

Run these commands from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the project lockfile on a fresh checkout |
| `npm install <package>` | Add a runtime dependency and update the lockfile |
| `npm install -D <package>` | Add development tooling and update the lockfile |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run the TypeScript build check and produce `dist/` |
| `npm run lint` | Run Oxlint using `.oxlintrc.json` |
| `npm run preview` | Preview an existing production build locally |

There is currently no `npm test` script. Do not report tests as passing when only
the build and lint checks were run.

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

- Follow `../DESIGN.md` for tokens, type, layout, components and data
  formatting. Update it when you add or change one.
- Use semantic elements, labeled controls, visible keyboard focus, and layouts
  that work on narrow screens. Verify changed interactions in a browser when one
  is available.
- Add dependencies when the requested work needs them. Reuse the installed stack
  and avoid introducing overlapping libraries without a concrete reason.
- After changing application code, dependencies, or build configuration, run
  `npm run build` and `npm run lint`. Report any failures or checks not run.
- For documentation-only changes, review the content and check whitespace;
  rebuilding the application is unnecessary.
- If a test runner is introduced, document its commands here. When the user
  explicitly requests tests, cover meaningful behavior. Keep generated output
  and `node_modules/` out of commits.
