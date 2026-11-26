# Mobile agent guidance

These instructions apply to `mobile/` and its descendants. Keep mobile work scoped
here unless the requested feature also requires changes elsewhere. Follow the
repository-wide guidance in `../AGENTS.md` as well.

Read and follow [CLEAN_CODE.md](../CLEAN_CODE.md) when writing or changing code.
It defines the shared JavaScript/TypeScript function conventions; continue
following the package-specific rules as well.

## User workflow preferences

- Do not write new tests or modify existing tests unless the user explicitly
  requests it. Feature implementation, bug fixes, and refactors do not imply a
  request to write tests.
- Do not read, inspect, search, tail, or retrieve logs unless the user explicitly
  requests it. This includes Metro, device, simulator, application, server, and
  system logs.

## Project context

- This is the Camioane Driver app: an Expo (React Native) app for iOS, Android,
  and browsers through React Native Web. All four roles (`ADMIN`, `OPERATOR`,
  `DRIVER`, `USER`) can use it. `appRoles` in `src/lib/user.ts` is the one place
  that decides the mobile role gate; server file authorization stays unchanged.
- It covers sign-in, session restore and sign-out against the existing
  `POST /users/login` and `GET /users/me`. The backend has no route, shift or
  fleet API yet, so the home screen says so instead of showing invented data.
  Read `../backend/README.md` and its source before connecting a feature; do not
  invent endpoints or response contracts.
- The signed-in HDMI test plays one local video on an external display, with
  phone controls only. It needs a development build; Expo Go and web show an
  unavailable state. Native source and the iOS config plugin live in
  `modules/hdmi-player/`, not the generated app folders. Playback belongs to the
  focused test screen and stops on navigation or session changes.
- **Playlist HDMI** opens `/playlist`, implemented in `src/features/playlist/`.
  One ordered MP4 list per account lives at `Paths.document/hdmi-playlist/<userId>/`:
  `playlist.json` stores metadata and `videos/<id>.mp4` stores permanent copies.
  The runtime decoder drops missing files; writes are serialized and the manifest
  is replaced through a temporary file. Phone imports use picker cache copies;
  server imports use the existing authenticated `/files` download flow and are
  disabled in local preview. Session/revision changes abort transfers.
- HDMI's native API is `start(id, expiresAt)`, `prepare(id, uris, startIndex?)`,
  `skip(id, index)`, `play/pause/stop/release(id)`. Status includes `index` and
  `count`; an empty list clears playback, and Stop rewinds to item zero with black
  output. Both platforms enforce login expiry natively. List edits preserve the
  current item where possible and require Play again. Removal must await prepare
  or its detached error codes before deleting the permanent file. Session cleanup
  never deletes playlist files. Keep the test's one-video API calls as `[uri]`.
- HDMI placement defaults to top-left 1:1, with explicit pixel offsets and uniform
  scale; crop outside the frame, never auto-fit or centre. `setPlacement(id,x,y,scale)`
  validates integer offsets −4096…4096 and finite scale 0.1…4, and `setPattern(id,enabled)`
  toggles a native HDMI-pixel grid. Both reject stale/expired sessions. Status includes
  `video`, `placement`, read-only `modes`, and `pattern`. Observe video display size
  across playlist changes; iOS disables overscan compensation and converts pixels to
  points, Android accounts for pixel aspect ratio and uses fixed pixel layout.
- `src/features/hdmi-placement/` stores X/Y/scale per phone (not account) in
  `Paths.document/hdmi-placement.json`, with validated reads and serialized temporary-file
  replacement (`localStorage` on web). Apply after start, before prepare in both test
  and playlist, and live from the test controls. The grid stays in HDMI coordinates,
  hides video, is never persisted, and clears on Stop/error/expiry. Keep conversions,
  Version A regions and editor resolution settings independent of HDMI placement.
- iOS preflights every asset, uses `AVPlayerLooper` for one item and replenishes an
  `AVQueuePlayer` for several. Playlist files are readable after first unlock and
  their directory is excluded from backup during preparation. Android loops with
  Media3 `REPEAT_MODE_ALL`, a local wake lock, and `HdmiPlaybackService` (mediaPlayback
  foreground service with an ongoing notification). API 30+ uses an independent
  display window context so switching apps can continue playback; older Android
  pauses in background. Pause, Stop, errors, display removal and release stop the
  service. No notification permission prompt is shown; Android 13+ may hide the
  notification in the drawer if permission is denied. Locking Android may still
  blank HDMI: use the dim control and verify the actual phone/adapter combination.
- `src/components/FilePicker.tsx` is shared with the screen editor (`actionLabel`,
  `selectedIds`); `DimOverlay.tsx` is shared with the HDMI test. Web and Expo Go
  show the unavailable state without attempting native playlist operations.
- The home screen's **Truck screen video** button opens `/hdmi-test?sample=truck-screen`
  with the bundled `assets/truck_screen.mp4` (2304 × 512) preselected. The regular
  HDMI test keeps `flower.mp4`. Both samples wait for Play and survive cleanup;
  only imported picker copies are deleted. Register bundled samples in `app.json`.
- **Ecrane camioane** opens `/screen` (optional `fileId`) for local/saved MP4
  selection, synchronized three-region preview, framing, conversion, upload and
  HDMI handoff. Feature code lives in `src/features/screen/`; the local
  `modules/screen-video/` module shares its compositor/effect between native
  preview and export. Keep the exact dashboard geometry and centered contain/
  cover calculations aligned. Output resolutions are a phone setting
  (`useResolutions.ts`, `resolutionStorage.ts`/`.web.ts`), not the admin
  `/screen-presets`: 2304 × 512 is built in, and `regionsFor` scales its region
  edges to other sizes. `resolutionProblem` (even sides, 64–4096) must match the
  checks in `ScreenComposition.swift` and `ScreenEffect.kt`. Web uses separate canvas/mediabunny modules.
  Keep native videos on disk and use session/job IDs to reject stale events.
  Foreground conversion keeps the screen awake; backgrounding, confirmed exit,
  or a session change cancels unfinished work. Release readers before deleting
  files. Upload retry reuses the result. HDMI takes a separate session-scoped
  copy, waits for Play and must not delete the editor's result on return.
- Use npm. `package.json` and `package-lock.json` are authoritative for versions.
  Keep them in sync.
- In development only, `admin` / `admin` opens an in-memory Operator preview.
  It has no access token, skips the server session check, blocks protected API
  calls, and ends on sign-out or a full reload. Keep this behind `__DEV__`;
  never turn these preview values into real backend credentials.
  Local conversion and HDMI work in this preview; server Files access does not.

## Local setup and running the app

- Use Node.js 24 or newer. Check the active Node version before installing or
  running commands; a shell may default to an older installed version.
- Run `npm ci` when dependencies are missing or out of date. Preserve existing
  environment files and settings.
- Follow `../backend/README.md` for the API and database prerequisites. The app
  can display its sign-in screen without a working API, but authentication needs
  the API, the current database schema, and an existing account. Do not describe
  a visible sign-in screen as a verified sign-in flow.
- Browser preview: run `npm run web`, then open `http://localhost:5173`.
  This is the driver app; the separate admin dashboard lives in `../frontend/`.
  Both default to port 5173. Check for an existing server before starting another,
  and do not terminate an unrelated process to free the port.
- Native preview: run `npm start`, then open the project in Expo Go or a
  compatible development build. A phone must be able to reach both Metro and
  the API. `localhost` on a physical phone refers to the phone itself.
- If Expo's automatic simulator-window activation fails, keep Metro running
  separately and open the project from the available Simulator or Device Hub.
  Verify the app is visible before reporting that it launched.

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
| `npm run web` | Run the driver app in a browser on port 5173; stop the admin dashboard first if it uses that port |
| `npm run ios` | Start Metro and open the iOS simulator |
| `npm run android` | Start Metro and open an Android device or emulator |
| `npm run build:ios -- --device` | Build and install the iOS development app with native HDMI support |
| `npm run build:android -- --device` | Build and install the Android development app with native HDMI support |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run lint` | Run Oxlint using `.oxlintrc.json`; it prints nothing when clean |
| `npx expo-doctor` | Check dependency versions and the app config |
| `npx expo export --platform android --platform ios --output-dir <tmp>` | Bundle both platforms with Metro without a device |
| `npx expo export --platform web --output-dir <tmp>` | Produce a browser bundle |

There is no test runner. Do not report tests as passing when only the checks
above ran.

## Browser support

- Keep `web` in `app.json`'s platforms and use Metro for web. Install browser
  dependencies through `npx expo install` so `react-dom`, `react-native-web`, and
  `@expo/metro-runtime` stay compatible with the installed SDK.
- Keep browser-specific code outside route files when possible. Metro resolves
  `.web.ts` modules for the browser; the base module must remain usable on native.
- SecureStore is a native API. Use `src/auth/storage.web.ts` for browser storage
  and `src/auth/storage.ts` for secure device storage. Keep their exports aligned.
  Browser sessions use the tab's `sessionStorage`, not persistent `localStorage`.
- Browser requests use CORS. The page's exact origin must match the backend's
  `FRONTEND_ORIGIN` (normally `http://localhost:5173`). Native requests have no
  browser-origin restriction. Do not disable CORS to make a preview work.
- Guard access to `window` or other browser globals when code can run outside
  the browser. Keep shared components and API helpers compatible with all three
  platforms.

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
- `src/auth/` holds session state, platform storage, and the current-user context;
  `src/lib/` holds the API client, query client, user types and validation, and
  theme tokens.
- `src/components/` holds components used by more than one screen. A small
  component used by one screen stays in that route file, unexported, as `Field`
  does in `sign-in.tsx`. Move it to `src/components/` once a second screen needs it.

## State and data

- Zustand (`src/auth/session.ts`) owns session state. Only the token and its
  expiry persist, under `camioane.session.v1`. `src/auth/storage.ts` uses
  `expo-secure-store` on native; `storage.web.ts` uses the browser tab's
  `sessionStorage`. Every session change goes through `replaceSession`, which
  aborts the global request signal, clears the TanStack Query cache, bumps
  `revision`, and persists the change. Storage writes are chained so they land
  in order on every platform.
- `startSessionSync` signs out at expiry and rechecks when the app returns to
  the foreground, because timers pause in the background.
- TanStack Query owns server data. Don't copy it into Zustand. `focusManager`
  treats the app becoming active as focus, so the session check refetches and a
  revoked token signs the user out.
- `src/lib/api.ts` is the single typed fetch client. It runtime-decodes every
  response, times out after 15 s (10 minutes for file transfers), drops responses that arrive after a session
  change, and signs out on a 401. Mirror changes to the web client's shared
  logic (`../frontend/src/lib/api.ts`, `../frontend/src/auth/session.ts`) when
  they apply here.
- `EXPO_PUBLIC_API_BASE_URL` is public: Metro inlines it into the bundle. In
  development it falls back to Metro's host on port 3000, or the page's host
  in the browser. Browser requests must match the backend's `FRONTEND_ORIGIN`.
  Release builds require an explicit HTTPS value. Never put secrets in
  `EXPO_PUBLIC_*` variables.

## UI and verification

- Follow `../DESIGN.md`. Its tokens and type scale live in `src/lib/theme.ts`;
  update both when either changes. Each IBM Plex Sans weight loads as its own
  family, so set `fontFamily` (`fonts.medium`), not `fontWeight`.
- Tappable elements are at least 44 points tall. Input text is 16px. Label every
  control for screen readers, and announce errors (`accessibilityRole="alert"`
  or `accessibilityLiveRegion`).
- After changing code, dependencies or config, run `npm run typecheck`,
  `npm run lint`, and the Android/iOS `expo export` bundle check. Include the web
  export for browser or shared-code changes.
- Verify browser changes in the browser. Check the changed interactions and
  reload behavior; check sign-in, restore, and sign-out when changing session
  handling and a usable backend/account is available. When a device or simulator
  is available, also check changed native interactions there.
- Report failures, checks that could not run, and backend prerequisites that
  block verification. Do not create accounts or change their roles just to make
  a check pass unless the user requests it.
- For documentation-only changes, review accuracy and run `git diff --check`;
  builds, servers, and database changes are unnecessary.
