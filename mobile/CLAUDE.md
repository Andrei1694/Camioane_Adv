# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read and follow [CLEAN_CODE.md](../CLEAN_CODE.md) when writing or changing code.
It defines the shared JavaScript/TypeScript function conventions; continue
following the package-specific rules as well.

## Overview

This is the **Camioane Driver** mobile app - an Expo (React Native) application for iOS, Android, and web. It serves drivers and operators of LED-screen trucks who run advertising campaigns. The app handles authentication, session management, and includes an HDMI video player for external display output. Backend APIs for route assignments, shifts, and fleet management don't exist yet.

**Stack:** Expo SDK 58, React Native 0.88, React 19, TypeScript 6, Zustand, TanStack Query, Expo Router.

## Commands

Run from `mobile/` using Node.js 24+:

```bash
# Setup
npm ci                           # Install dependencies (required after clone or updates)

# Development
npm start                        # Start Metro; open in Expo Go or dev build
npm run web                      # Run driver app in browser at http://localhost:5173
npm run ios                      # Start Metro and open iOS simulator
npm run android                  # Start Metro and open Android emulator

# Native builds (require native toolchains)
npm run build:ios -- --device    # Build & install iOS dev app with HDMI support
npm run build:android -- --device # Build & install Android dev app with HDMI support

# Verification
npm run typecheck                # Type-check with tsc --noEmit
npm run lint                     # Run Oxlint (silent when clean)
npx expo-doctor                  # Check dependency versions and config
npx expo export --platform android --platform ios --output-dir /tmp/test  # Bundle both platforms
npx expo export --platform web --output-dir /tmp/test-web                 # Bundle for web

# Dependencies
npx expo install <package>       # Add Expo/React Native dependencies (use this, not npm install)
npm install <package>            # Add plain JS dependencies only
```

**Important:** There is no test runner. Don't report tests as passing when only build/lint/typecheck ran.

## Development Setup

1. **Backend required:** Start the backend first (see `../backend/README.md`). The app can show sign-in without it, but authentication requires a running API, database, and existing account.

2. **API address:**
   - Development: Defaults to Metro's host on port 3000 (e.g., `http://192.168.1.20:3000`)
   - To override: Copy `.env.example` to `.env.local`, set `EXPO_PUBLIC_API_BASE_URL`, restart Metro
   - Browser: Must match backend's `FRONTEND_ORIGIN` (default `http://localhost:5173`)
   - Production builds: Require explicit HTTPS value, no fallback

3. **Preview modes:**
   - **Expo Go:** `npm start`, scan QR code (HDMI test unavailable)
   - **Browser:** `npm run web` at port 5173 (conflicts with admin dashboard port)
   - **Development build:** `npm run build:ios|android -- --device` for HDMI test

4. **Offline preview account:** In every build, Release included, `admin` / `admin` opens a local Operator preview with no backend token, so the app runs without Metro or the API. This is memory-only, blocks API calls, and never becomes a real credential. Only dev builds prefill and mention it on the sign-in screen.

## Architecture

### Session & Authentication
- **Session store:** Zustand (`src/auth/session.ts`) persists only token + expiry under `camioane.session.v1`
- **Storage:**
  - Native: `expo-secure-store` (iOS Keychain/Android Keystore) via `src/auth/storage.ts`
  - Web: `sessionStorage` via `src/auth/storage.web.ts`
- **Flow:** `POST /users/login` → verify with `GET /users/me` → check on foreground return
- **Sign-out triggers:** 401 response, token expiry, manual sign-out
- **Session changes:** Every change aborts requests, clears query cache, bumps `revision`, persists changes

### API Client
- **Single source:** `src/lib/api.ts` - typed fetch with runtime decoding
- **Features:**
  - 15s timeout via `AbortSignal.timeout`
  - Automatic 401 sign-out
  - Drops responses arriving after session changes
  - Preview mode blocks authenticated requests
- **Endpoints:** Currently only `/users/login` and `/users/me`

### Routing & State
- **Router:** Expo Router with file-based routes in `src/app/`
  - `_layout.tsx`: Splash → load fonts/session → `Stack.Protected` gate
  - `(app)/_layout.tsx`: Checks session, applies role gate, provides `UserContext`, keyed on `revision`
  - `sign-in.tsx`: Sign-in screen
  - `(app)/index.tsx`: Home screen (shows "assignments unavailable")
  - `(app)/hdmi-test.tsx`: HDMI video player (dev builds only)

- **Data:** TanStack Query owns server data (never copy to Zustand)
  - `focusManager` rechecks session when app becomes active
  - Queries invalidated on session changes

### Native Integration: HDMI Player
- **Location:** `modules/hdmi-player/` (local Expo module, autolinked)
- **Config plugin:** `modules/hdmi-player/app.plugin.js` modifies native projects
- **Platform implementations:**
  - iOS: `AVQueuePlayer` + `AVPlayerLooper` with external `AVPlayerLayer`, separate scene for external display
  - Android: Media3 ExoPlayer in a `Presentation`
  - Web: Unavailable state shown
- **Generated folders:** `ios/` and `android/` are created by `expo prebuild`/EAS Build, not committed
- **Rebuilds required:** After native dependency changes, config changes, or HDMI module updates

### HDMI playlists

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

### Cross-Platform Considerations
- **Platform-specific files:** `.web.ts` modules override base `.ts` for browser (e.g., `storage.web.ts`)
- **React Native differences from browser:**
  - `URL` class doesn't validate (use regex checks)
  - No global `DOMException` (cancellations are `Error` with name `AbortError`)
  - `fetch` appends cache-busting params if `cache` option used (don't pass it)
  - `AbortSignal.timeout` and `AbortSignal.any` available in RN 0.88

## Code Conventions

- **Style:** Two-space indent, single quotes, no semicolons, `import type` for types, relative imports only
- **TypeScript:** Strict mode with `verbatimModuleSyntax`, `erasableSyntaxOnly`, unused checks enabled
- **Avoid:** Enums, parameter properties (use object types instead)
- **Component placement:**
  - Single-use: Keep in route file unexported
  - Multi-use: Move to `src/components/`

## File Structure

```
src/
├── app/                    # Expo Router routes (screens + layouts only)
│   ├── _layout.tsx         # Root: splash, session hydration, protected routing
│   ├── sign-in.tsx         # Sign-in screen
│   └── (app)/              # Authenticated routes group
│       ├── _layout.tsx     # Session check, role gate, UserContext provider
│       ├── index.tsx       # Home screen
│       └── hdmi-test.tsx   # HDMI player (lazy-loaded)
├── auth/                   # Session management
│   ├── session.ts          # Zustand store, sign-in/out, sync logic
│   ├── storage.ts          # Secure store (native)
│   ├── storage.web.ts      # SessionStorage (browser)
│   └── currentUser.tsx     # UserContext provider
├── lib/                    # Shared utilities
│   ├── api.ts              # Typed fetch client with decoders
│   ├── queryClient.ts      # TanStack Query configuration
│   ├── screenBrightness.ts # Native dim/restore; screenBrightness.web.ts disables it on web
│   ├── theme.ts            # Design tokens, type scale (from ../DESIGN.md)
│   ├── user.ts             # User types, role validation
│   ├── useHdmiTest.ts      # HDMI test hook
│   └── useScreenDim.ts     # Dim overlay state and brightness lifecycle
├── components/             # Shared components
│   ├── Button.tsx          # Button component
│   └── Screen.tsx          # Screen layout wrapper
└── env.d.ts                # Expo types reference

modules/hdmi-player/        # Native HDMI module (local Expo module)
├── index.ts                # Native module exports
├── index.web.ts            # Web unavailable state
├── app.plugin.js           # Expo config plugin
├── ios/                    # iOS native code (AVFoundation)
├── android/                # Android native code (Media3)
└── src/                    # TypeScript types

ios/                        # Generated by expo prebuild (not committed)
android/                    # Generated by expo prebuild (not committed)
```

## Verification After Changes

1. **Always run:**
   ```bash
   npm run typecheck
   npm run lint
   npx expo export --platform android --platform ios --output-dir /tmp/test
   ```

2. **For browser/shared code changes:**
   ```bash
   npx expo export --platform web --output-dir /tmp/test-web
   ```

3. **Manual testing:**
   - Browser changes: Verify in browser
   - Native changes: Test on device/simulator when available
   - Session handling: Check sign-in, restore, sign-out if backend available

4. **Report honestly:** State if checks couldn't run or backend prerequisites are missing

## Key Files to Check Before Changes

- `package.json` / `package-lock.json`: Dependency versions (keep in sync)
- `app.json`: Native config (bundle IDs can't change after publish)
- `.oxlintrc.json`: Linting rules
- `tsconfig.json`: TypeScript strict config
- `../DESIGN.md`: Design tokens and type scale (mobile section)
- `../AGENTS.md`: Repository-wide rules
- `AGENTS.md`: Mobile-specific rules (read before making changes)
- `README.md`: Setup instructions and hardware verification

## Role Gate

Only `DRIVER` and `OPERATOR` roles access app features. Other roles see explanation + sign-out button. The gate is in `src/lib/user.ts` (`appRoles` function).

## Expo SDK Version Awareness

**Critical:** Expo ships breaking changes every SDK release. Before using Expo/EAS/React Native APIs:
1. Check `expo` version in `package.json` (currently SDK 58)
2. Verify API in `node_modules` type definitions
3. Reference versioned docs: `https://docs.expo.dev/versions/v58.0.0/`
4. For general info: `https://docs.expo.dev/llms.txt`

## User Workflow Preferences

- **Don't write tests** unless explicitly requested (feature work doesn't imply test request)
- **Don't read logs** (Metro, device, application, server) unless explicitly requested
- **Don't create accounts** or change roles to make checks pass unless requested
