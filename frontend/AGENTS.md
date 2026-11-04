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
- Zustand, TanStack Query, TanStack Router, and TanStack Table are installed.
  At the time of writing, the app still renders the Vite starter; stores, query
  providers, routes, and tables have not been configured. Check the source before
  assuming an integration exists, and update this note as integrations are added.
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
- `src/main.tsx` is the entry point, `src/App.tsx` is the current root component,
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
- Use TanStack Router for application navigation. Configure its provider and
  route tree when routing is introduced; file-route generation is not currently
  configured.
- Use TanStack Table for table behavior where needed. Verify APIs against the
  installed major version before using examples from another version.
- Reuse existing integrations as they develop. Keep the router and query client
  stable across renders, and handle loading, empty, and error states in data views.
- Keep API calls in reusable typed modules or hooks. Check HTTP failures and
  propagate useful errors. Keep database access and private credentials in the
  backend; browser configuration, including `VITE_*` variables, is public.

## UI and verification

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
