# Camioane Driver (mobile)

An Expo (React Native) app for the drivers and operators of the LED-screen trucks. It signs in with an existing account, keeps the session in the device's secure storage, and includes an HDMI video test for Android and iPhone development builds. The backend has no route, shift or fleet API yet, so the home screen says assignments aren't available rather than showing invented data.

Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router, TanStack Query and Zustand.

## Accounts

There is no registration. An administrator creates accounts on the web dashboard's Users page (`../frontend`) and gives them the Driver or Operator role. Admin and User accounts can sign in, but the app only tells them it's for drivers and operators and offers sign-out.

Development mode prefills `admin` / `admin`. Press **Sign in** to open an Operator screen preview without a backend login. This is a local preview identity, not a real administrator account: it creates no token, cannot call protected APIs, and ends on sign-out or a full reload. The shortcut and prefilled values are disabled in production builds. Replace the fields with your real account details to use normal sign-in.

## Development

Requirements: Node.js 24+ and npm. To run the app, use either the Expo Go app on a phone on the same Wi-Fi as your computer, or an iOS Simulator (macOS with Xcode) or Android emulator (Android Studio).

Start the backend first; see `../backend/README.md`. Then, from `mobile/`:

```sh
npm ci
npm start
```

For the HDMI test, install a development build as described below, then open the development server from that app. To preview sign-in in Expo Go, run `npx expo start --go`; Expo Go displays an explanation instead of enabling the HDMI test.

To run the same driver app in a browser:

```sh
npm run web
```

Open `http://localhost:5173`. This uses the same port as the admin dashboard, so stop the dashboard first if it is running. The default port matches the API's `FRONTEND_ORIGIN`; if you use another browser origin, configure the backend to allow it. Browser sessions use the current tab's `sessionStorage`, survive reloads, and end when the tab closes. Native apps continue to use secure device storage.

### API address

In development the app calls the API on the computer that runs Metro: it takes the host from Metro's address and uses port 3000, for example `http://192.168.1.20:3000`. The backend listens on every network interface, so this works from a phone on the same network as long as the computer's firewall lets in port 3000.

To use another address, for example with `npx expo start --tunnel` or a remote API, copy `.env.example` to `.env.local`, set `EXPO_PUBLIC_API_BASE_URL`, and restart Metro. The value is public: Metro inlines it into the app bundle. Never put secrets in it.

CORS doesn't apply to native apps, which send no `Origin` header. The browser version does use CORS and must match the backend's `FRONTEND_ORIGIN`, which also serves the web dashboard; `WEBSITE_ORIGIN` configures the separate website's allowed origin. In browser development, the API defaults to the page's hostname on port 3000. Every protected request still needs the bearer token.

## Sign-in and sessions

- The app signs in with `POST /users/login` and checks the account with `GET /users/me` before any signed-in screen renders. It checks again each time the app returns to the foreground.
- Only the one-hour access token and its expiry are stored, in the iOS Keychain or Android Keystore through `expo-secure-store`. Reopening the app restores an unexpired session; it is still verified with the API first.
- The app signs out, with an explanation, when the token expires or the API answers 401. That happens, for example, after an administrator changes the account's email, password or role. Sign-out discards the token on the device. As on the web, there are no refresh tokens or server-side logout.
- If the session can't be verified (no connection, or the API is down), the app offers Retry and Sign out without discarding the session.

## Checks

```sh
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android --platform ios --output-dir /tmp/camioane-export
npx expo export --platform web --output-dir /tmp/camioane-web-export
```

`npm run lint` prints nothing when there are no issues. The export check bundles both platforms with Metro without a device. There is no test runner yet.

## Builds

`ios/` and `android/` are generated from `app.json` (Continuous Native Generation) and not committed. Use EAS Build (`npx eas-cli@latest build`) or `npx expo prebuild` followed by `npx expo run:ios|android`.

For a local development build, use Node.js 24+ and run one of these from `mobile/`:

```sh
# Android Studio, an Android SDK, and its bundled JDK are required.
npm run build:android -- --device

# macOS, Xcode 27+, CocoaPods, and device signing are required for a physical iPhone.
npm run build:ios -- --device
```

These commands generate the native projects, compile the app, install it on the selected device, and start Metro. Later JavaScript-only changes only need `npm start`. Rebuild after changing native code or dependencies; rerun `npx expo prebuild` after changing app configuration or the HDMI config plugin. Do not edit generated native projects by hand.

The tracked native integration lives in `modules/hdmi-player`. Expo autolinks that local module. Its config plugin adds a separate iOS external-display scene while preserving Expo's phone scene; iOS 27+ also registers a scene accessory at runtime. Android uses a `Presentation` with Media3 ExoPlayer. iOS uses `AVQueuePlayer`, `AVPlayerLooper`, and an external `AVPlayerLayer`. Expo Go cannot load this custom module, and web does not provide HDMI playback.

Before a production build:

- Set `EXPO_PUBLIC_API_BASE_URL` to the deployed API's HTTPS URL. Release builds have no fallback and refuse plain HTTP.
- Confirm the placeholder `ios.bundleIdentifier` and `android.package` (`com.camioane.driver`) in `app.json`. They can't change after the app is published.

The icon and splash come from `../assets/app-icon/`. The iOS icon is flattened onto white because the App Store rejects icons with transparency.

## HDMI test

1. Install a development build and sign in with an existing Driver or Operator account.
2. Connect a video-output-capable phone through a compatible HDMI adapter. For the truck, connect to the TB60's **HDMI IN** and select its HDMI/synchronous input using the controller's existing tools.
3. Open **HDMI test** from the home screen. Confirm that an external display and its negotiated pixel resolution appear.
4. The included **flower.mp4** sample loads automatically and waits for Play. To use your own video, tap **Choose video** and select a downloaded local video in the system file picker. H.264 in an MP4 container is a useful compatibility baseline. Cloud-provider files must finish downloading/copying before playback can prepare.
5. Tap **Play**. Video loops silently on the external display, fitted with black bars where needed. There is no phone preview. Pause retains the external frame; Stop resets playback and makes the external output black.
6. While playing, tap **Dim phone screen** to cover the phone with black at minimum brightness while HDMI continues playing. Press and hold anywhere for one second to show controls and restore brightness. Ordinary taps do nothing; screen-reader users can activate the overlay with a double-tap. Android Back also wakes the controls.

The phone stays awake while playing or buffering unless you lock it manually. Buffering displays **Buffering…**, retains Pause and Stop controls, and continues playback when the native player is ready. It does not restart initial file preparation. On iPhone, playback started with Play continues on HDMI when switching apps or locking the phone. The iOS module uses the media background mode, an active playback audio session with mixing, and AVPlayer’s `continuesIfPossible` background policy; video remains muted. It keeps the external video layer attached and visible. Android still pauses on backgrounding or locking and does not acquire audio focus. Opening the file picker, disconnecting HDMI, native interruptions, or unexpected pauses require an explicit Play afterward. Returning never restarts paused or stopped playback. Back, navigation away from the HDMI test, sign-out, and session expiry end the test and release the native player, including any pending preparation. The one-hour session expiry still applies: iOS receives the login deadline and enforces it natively even while JavaScript timers are suspended. Keep-awake warnings remain through buffering and disappear when playback pauses, stops, fails, or ends.

Android retains the attached presentation while its display remains eligible, valid, and visible, even if another display appears or enumeration order changes. When a replacement is needed, the eligible display with the lowest ID is selected, excluding the phone's built-in displays. The replacement starts black and requires Play.

Use **Dim phone screen** to keep the controls covered during playback. iPhone can also be locked while HDMI continues; Android must remain unlocked. A new dim operation is available only while actually playing, but buffering preserves an existing or pending dim operation and keeps the phone awake. The controls automatically return and brightness restoration is attempted when playback pauses, stops or fails, HDMI disconnects, the app goes into the background, or you leave the screen (including sign-out and session expiry). Brief iOS overlays that only make the app inactive keep dim mode enabled. On iOS, waking restores the saved brightness; Android returns to the system brightness setting. If dimming fails, the controls stay visible and an error appears.

Leaving iPhone foreground mode restores the phone brightness and closes the dim overlay without pausing HDMI. Dim mode uses the native `expo-brightness` module, so rebuild the development app after adding or updating it. It is unavailable on web. If the app is killed while dimmed on iOS, brightness may stay low until the phone is next locked. For unattended truck use, Guided Access on iOS or app pinning on Android can keep controls restricted; keep the phone connected to a charger.

Imported files are copied into app cache; your original file is not modified or deleted. The included sample is a shared app asset and is never deleted by HDMI session cleanup. A new selection is committed only after native preparation confirms that it is playable; controls remain busy during preparation. A failed replacement clears the selection and removes its imported copy and any detached previous imported copy. A later decoder failure also clears the selection after releasing the video. Canceling the picker retains the previous selection, paused. A preliminary Pause failure is reported separately and does not prevent opening the picker.

Replacing a file or leaving the test removes its imported copy only after native detachment is confirmed. Disposal waits for startup, releases the player, and retries release once if it fails. If release still fails, copies are retained and a cleanup warning appears on the next visit to the HDMI test. An unexpected preparation or teardown failure requires leaving and reopening the test; its copies are retained until release succeeds. File choice and playback do not persist across launches; every new HDMI test starts with the included sample and never autoplays. If the app is terminated abruptly or cache deletion fails, the OS may retain the temporary copy until cache eviction.

On iOS, `start(sessionId, expiresAt)` accepts the login expiry in epoch milliseconds, or null for the development preview. Android continues to use `start(sessionId)`. The native `prepare(sessionId, uri)` promise resolves on playable readiness, rejects after media failure cleanup, and is cancelled by replacement, release, or module destruction. Status events reserve `loading` for initial preparation and report `buffering` only while an explicit Play request is waiting for media. Pause, Stop, interruption, disconnection, and Android backgrounding clear that request; late native events cannot resume it or replace the stopped/error state. Rebuild the development app after changing this native contract; a JavaScript reload alone is insufficient.

This version uses one video and one external display. It does not stream from the API, create a playlist, set custom HDMI timings, or compose the three truck regions. It does not configure TB60 mapping or scaling. The displayed resolution is the output mode negotiated by the phone and adapter, not the dimensions of the video file. USB-C alone does not guarantee video-output support; screen-mirroring-only adapters may not expose a separate display.

### iPhone background playback

The HDMI config plugin merges `audio` into `UIBackgroundModes`; regenerate iOS and rebuild after changing it. The audio session activates only when Play succeeds and deactivates on Pause, Stop, failure, or release. Mixing allows other apps to play audio while this video stays muted. No silent helper track, background task loop, or phone video view is added. Calls and other system interruptions may still pause playback and require Play in the foreground. Unplugging HDMI also pauses; reconnecting requires Play.

App-owned cached videos use file protection that permits reads after the first device unlock, so looping can read the file while the phone is locked. Original documents and bundled assets are not modified. Force-quitting or iOS terminating the app ends playback. Apple's [background playback policy](https://developer.apple.com/documentation/avfoundation/avplayer/audiovisualbackgroundplaybackpolicy) is best effort; verify moving HDMI video on the intended phone/adapter/display while another app is open and after the phone fully locks before recording hardware support.

Background playback implementation verified on 2026-11-18: type checking, lint, all three platform exports, and the signed iPhone build passed. The installed app's Info.plist contains the media background mode. The rebuilt app opened on the connected iPhone 15 Pro Max, and the HDMI screen loaded flower.mp4 to Ready to play with the updated instructions. No external display was connected; continued video while switching apps/locking, interruptions, and native expiry while locked remain unverified. Physical HDMI checks remain deferred at the user's request. No automated tests were added or modified.

### Included sample

`assets/flower.mp4` is the same 5-second, 960 × 540 H.264 sample included in Frame's `video-player` project. It is bundled through `expo-asset`; rebuild after adding or changing the asset configuration. Development builds load JavaScript and assets through Metro as usual.

The video is MDN's CC0 flower sample, originally downloaded by Frame on 2026-10-28:

- [Original video](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)
- [Source repository (CC0-1.0)](https://github.com/mdn/interactive-examples)

Sample integration verified on 2026-11-18: the copied file matches Frame's SHA-256 checksum. Type checking, lint, iOS/Android/web exports, Android resource packaging, and a signed iPhone build passed. The rebuilt app was installed and opened on the connected iPhone 15 Pro Max. The sample reached Ready to play without HDMI; Stop, picker cancellation, and leaving/reopening the test preserved or reloaded the sample correctly. External playback remains deferred as requested.

### Hardware verification

Compilation and simulator checks cannot establish physical HDMI compatibility. On each test phone, check:

- No display connected: Play is disabled and the phone never shows video.
- Open the test: the included sample reaches Ready to play. Leave and reopen: it loads again. Cancel a replacement: the sample remains selected. Check looping with both the sample and an imported H.264 MP4.
- Connect before opening the test and connect while it is already open; both show the display and its resolution.
- Choose/cancel/replace a file, including an unreadable or unsupported file; readable errors appear and the original files remain intact.
- After a failed replacement, confirm “No video selected”, disabled playback controls, removed temporary copies, and successful selection of another video.
- Play for at least ten minutes, crossing multiple loop boundaries. Check fitting, black bars, muted audio, and phone controls without a preview.
- Dim while playing and leave the phone dimmed for at least ten minutes across loop boundaries: HDMI continues, the phone stays awake and black at minimum brightness, and ordinary taps do not wake it.
- Press and hold for one second to wake; controls and the earlier iOS brightness or Android system brightness return. Repeat with the screen reader's activate gesture and Android Back.
- While dimmed, disconnect HDMI, switch apps, and leave the test using Back after waking: controls return and brightness is restored. Switching apps on iPhone must keep HDMI moving; Android must pause. Also check sign-out and session expiry cleanup, including during a pending dim operation.
- The dim button is disabled unless playback is playing and controls are not busy. It is absent on web.
- Pause, resume, and Stop; Stop must black out HDMI and the next Play must start from the beginning.
- During buffering, confirm that Pause and Stop still work, an existing dim overlay and keep-awake remain active, and playback recovers without another Play. Starting a new dim operation must remain disabled until video is playing.
- Interrupt native playback while dimmed: controls and brightness return, status says Paused, and ending the interruption does not resume playback. Check that late player events after Stop or a decoder failure cannot change the terminal state.
- On Android, add or change another presentation display while playing: the current valid output must remain selected. Removing it may select another eligible display, but the new output stays black until Play.
- Disconnect/reconnect on either platform: require an explicit Play to resume. On Android, switching apps and lock/unlock also require Play. On iPhone, switch apps and fully lock the phone for at least ten minutes: HDMI must keep moving across loop boundaries, with the sample and an imported MP4. Unlock/return must preserve playing, paused, or stopped state without restarting the video. Verify expiry stops output while locked, and test an imported MP4 without an audio track.
- Open and dismiss Control Center or a brief system alert on iOS while dimmed: playback continues and dim mode remains enabled unless the app actually backgrounds.
- Leave during file selection or preparation, reopen, sign out, and allow the session to expire: no orphaned playback or retained selection.
- Repeat on the actual TB60 installation and confirm its input/mapping separately.

Software verification on 2026-11-18: type checking, Oxlint, and Android/iOS/web bundle exports passed. The Android HDMI module compiled, and unsigned iPhone and simulator builds completed with the latest HDMI source; Xcode emitted toolchain/dependency diagnostics. On the rebuilt iOS simulator, local preview sign-in, HDMI screen entry, picker cancellation, and leaving/reopening the screen worked. Browser preview sign-in, the unavailable HDMI state, Back, and sign-out worked. No automated tests were added or modified. External playback, buffering recovery, interruptions, multi-display switching, and ten-minute looping were not exercised; physical HDMI/TB60 checks were deferred at the user's request.

Record actual results here after connecting hardware; no physical device/adapter combination is certified by this change:

| Platform | Phone / OS | Adapter / cable | HDMI mode | 10-minute loop | Reconnect / lifecycle | TB60 result |
| --- | --- | --- | --- | --- | --- | --- |
| Android | Pending | Pending | Pending | Not verified | Not verified | Not verified |
| iPhone | Pending | Pending | Pending | Not verified | Not verified | Not verified |
