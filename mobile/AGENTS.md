# Mobile agent guidance

These instructions apply to `mobile/` and its descendants. Keep mobile work scoped
here unless the requested feature also requires changes elsewhere.

## User workflow preferences

- Do not write new tests or modify existing tests unless the user explicitly
  requests it. Feature implementation, bug fixes, and refactors do not imply a
  request to write tests.
- Do not read, inspect, search, tail, or retrieve logs unless the user explicitly
  requests it. This includes Metro, device, simulator, application, server, and
  system logs.

## Project context

- This is the Camioane Driver app: an Expo (React Native) app for drivers and
  operators, the `DRIVER` and `OPERATOR` roles. Other roles can sign in but see an
  explanation and a sign-out button. `appRoles` in `src/lib/user.ts` is the one
  place that decides this.
- So far it covers sign-in, session restore and sign-out against the existing
  `POST /users/login` and `GET /users/me`. The backend has no route, shift or
  fleet API yet, so the home screen says so instead of showing invented data.
  Read `../backend/README.md` and its source before connecting a feature; do not
  invent endpoints or response contracts.
- Use npm. `package.json` and `package-lock.json` are authoritative for versions.
  Keep them in sync.

## Expo changes between SDKs — check the installed version

Expo ships breaking changes in every SDK release, and APIs you remember may be
renamed, moved or removed. Before writing code against an Expo, EAS or React
Native API:

1. Read the major version of `expo` in `package.json` (currently SDK 58).
2. Check the installed package's type definitions in `node_modules`, and the
   matching versioned docs at `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For anything else, start from `https://docs.expo.dev/llms.txt`.

React Native differs from the browser in ways the web client's code relies on:

- React Native's `URL` class doesn't validate its input. Check URL shapes with a
  regex, as `apiBase` in `src/lib/api.ts` does.
- There is no global `DOMException`. Cancellations throw an `Error` named
  `AbortError`.
- The `fetch` polyfill appends `_=<time>` to the URL when given a `cache` option,
  so don't pass one.
- `AbortSignal.timeout` and `AbortSignal.any` exist in React Native 0.88; recheck
  this if React Native changes major version.

## Commands

Run these from `mobile/`:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the lockfile |
| `npx expo install <package>` | Add a dependency at the version matching the SDK. Use it instead of `npm install` for anything Expo or React Native |
| `npm install <package>` | Add a plain JavaScript dependency with no native code |
| `npm start` | Start Metro; open the app in Expo Go or a development build |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run lint` | Run Oxlint using `.oxlintrc.json`; it prints nothing when clean |
| `npx expo-doctor` | Check dependency versions and the app config |
| `npx expo export --platform android --platform ios --output-dir <tmp>` | Bundle both platforms with Metro without a device |

There is no test runner. Do not report tests as passing when only the checks
above ran.

## Native code and builds

- `ios/` and `android/` are generated (Continuous Native Generation) and ignored
  by Git. Never create or edit them by hand; configure native behaviour in
  `app.json` and config plugins. Run `npx expo prebuild` or EAS Build to produce them.
- Expo Go includes only its bundled native modules. After adding a library with
  native code, the app needs a development build: `npx expo run:ios|android`
  locally, or `npx eas-cli@latest build --profile development`.
- `ios.bundleIdentifier` and `android.package` (`com.camioane.driver`) are
  placeholders. Confirm them before the first store build: they can't change
  after publishing.
- Prefer Expo modules over third-party libraries, and reuse the installed stack
  before adding overlapping dependencies.

## Code conventions

- Match the frontend: TypeScript function components with hooks, two-space
  indentation, single quotes, no semicolons, `import type` for type-only
  imports, and relative imports only.
- `tsconfig.json` enables `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`
  and the unused-code checks. Avoid enums and parameter properties. Do not weaken
  checks to make code compile.
- `src/env.d.ts` references `expo/types` so a fresh checkout type-checks without
  the untracked `expo-env.d.ts` that `expo start` writes.

## Structure

- `src/app/` holds Expo Router routes only: every file there is a screen, and
  `_layout.tsx` files define navigators. Keep everything else outside it.
  - `_layout.tsx` holds the splash screen until fonts and the saved session load,
    and uses `Stack.Protected` to show `(app)` when signed in and `sign-in`
    otherwise.
  - `(app)/_layout.tsx` checks every session with `GET /users/me`, applies the
    role gate, and provides `UserContext`. It is keyed on the session `revision`.
- `src/auth/` holds session state; `src/lib/` holds the API client, query client,
  user types and validation, and theme tokens.
- `src/components/` holds components used by more than one screen. A small
  component used by one screen stays in that route file, unexported, as `Field`
  does in `sign-in.tsx`. Move it to `src/components/` once a second screen needs it.

## State and data

- Zustand (`src/auth/session.ts`) owns session state. Only the token and its
  expiry persist, in `expo-secure-store` under `camioane.session.v1`. Every
  session change goes through `replaceSession`, which aborts the global request
  signal, clears the TanStack Query cache, bumps `revision`, and persists the
  change. Secure-store writes are chained so they land in order.
- `startSessionSync` signs out at expiry and rechecks when the app returns to
  the foreground, because timers pause in the background.
- TanStack Query owns server data. Don't copy it into Zustand. `focusManager`
  treats the app becoming active as focus, so the session check refetches and a
  revoked token signs the user out.
- `src/lib/api.ts` is the single typed fetch client. It runtime-decodes every
  response, times out after 15 s, drops responses that arrive after a session
  change, and signs out on a 401. Mirror changes to the web client's shared
  logic (`../frontend/src/lib/api.ts`, `../frontend/src/auth/session.ts`) when
  they apply here.
- `EXPO_PUBLIC_API_BASE_URL` is public: Metro inlines it into the bundle. In
  development it falls back to Metro's host on port 3000. Release builds require
  an explicit HTTPS value. Never put secrets in `EXPO_PUBLIC_*` variables.

## UI and verification

- Follow `../DESIGN.md`. Its tokens and type scale live in `src/lib/theme.ts`;
  update both when either changes. Each IBM Plex Sans weight loads as its own
  family, so set `fontFamily` (`fonts.medium`), not `fontWeight`.
- Tappable elements are at least 44 points tall. Input text is 16px. Label every
  control for screen readers, and announce errors (`accessibilityRole="alert"`
  or `accessibilityLiveRegion`).
- After changing code, dependencies or config, run `npm run typecheck`,
  `npm run lint`, and the `expo export` bundle check. When a device or simulator
  is available, also check the changed interactions there. Report any failures
  or checks that couldn't run.
