# Camioane Driver (mobile)

An Expo (React Native) app for the LED-screen trucks. It signs in with an existing account, keeps the session in the device's secure storage, converts videos into the three-region truck layout, and includes an HDMI player for Android and iPhone development builds. The backend has no route, shift or fleet API yet, so the home screen says assignments aren't available rather than showing invented data.

Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router, TanStack Query and Zustand.

## Accounts

There is no registration. An administrator creates accounts on the web dashboard's Users page (`../admin`). ADMIN, OPERATOR, DRIVER and USER can all open the mobile app, including **Ecrane camioane**. File visibility and saving remain controlled by the server's existing permissions; enabling a mobile role grants no access to another account's files.

Sign in with `admin` / `admin` to open an offline Operator preview without a backend login. It works in every build, including a Release build installed on a phone with no Metro server or API. This is a local preview identity, not a real administrator account: it creates no token, cannot call protected APIs, and ends on sign-out or a full reload, so sign in again after the app restarts. Development mode prefills these values and mentions them on the sign-in screen; Release builds show empty fields. Replace the fields with your real account details to use normal sign-in.

## Development

Requirements: Node.js 24+ and npm. To run the app, use either the Expo Go app on a phone on the same Wi-Fi as your computer, or an iOS Simulator (macOS with Xcode) or Android emulator (Android Studio).

Start the backend first; see `../backend/README.md`. Then, from `mobile/`:

```sh
npm ci
npm start
```

For native conversion and HDMI, install a development build as described below, then open the development server from that app. To preview sign-in in Expo Go, run `npx expo start --go`; Expo Go displays an explanation instead of enabling the custom native converter and HDMI player. The browser has its own converter but cannot play on HDMI.

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

## Ecrane camioane

Open **Ecrane camioane** on Home (`/screen`, optionally `/screen?fileId=<id>`). Choose an MP4 from the phone or the paginated **Fișiere** picker. The picker uses `GET /files?limit=50&offset=…` and authenticated `GET /files/:id/download`; it only offers MP4 files for this workflow. It does not add file management or change server permissions.

**Rezoluție** picks the output width × height. **2304 × 512 · Versiunea A** is built in and can't be removed. Add other sizes with **Lățime** and **Înălțime**: even numbers from 64 to 4096, the same limits the native converters enforce. The list and the selected size are saved on the phone, not on the server or per account (`Paths.document/screen-resolutions.json`; the browser preview uses `localStorage`). Deleting the selected size falls back to 2304 × 512. Changing the size discards a finished conversion, as changing the framing does.

The synchronized preview shows three copies of the same source on a black canvas at the selected size. At 2304 × 512 the regions exactly match the dashboard: left **1018 × 512 at x=0**, middle **512 × 512 at x=1024**, right **719 × 512 at x=1585**, all at y=0. Other sizes scale these region edges proportionally, so the right region still ends at the canvas edge; each region section shows its scaled rectangle. Each defaults to **Încadrează cu bandă neagră** (contain); choose **Decupează pentru umplere** (centered cover) independently. Use Play/Pause and the seek control to inspect framing. The source filename, size and duration remain visible.

**Convertește și salvează în Fișiere** creates H.264 MP4, preserving source audio, upright orientation and the original file. Native audio is encoded as AAC; the browser prefers AAC and can use Opus when its encoder requires it, matching the dashboard. The filename is `<original name> (ecran camion <width>x<height>).mp4`. iOS encodes at 12 Mbps for 2304 × 512 and scales the bitrate with the pixel count for other sizes (2–50 Mbps); Android uses its encoder's default bitrate and the browser uses mediabunny's high-quality setting, both of which already depend on the size. Conversion and multipart `POST /files` upload have separate progress phases, cancellation and retry. A failed upload retains the finished conversion: **Salvează rezultatul în Fișiere** retries the upload without encoding again. Unsupported exact-size encoding reports an error rather than silently changing dimensions.

After conversion, **Redă pe HDMI** opens the existing player with a separate temporary copy and waits for explicit **Play**. It also works after an upload failure. Opening HDMI during an upload cancels that transfer; returning allows saving the existing conversion. The player's looping, dimming and background behavior are unchanged, including muted HDMI audio. Returning to the editor retains its source, framing and result. Both original HDMI sample shortcuts remain available on Home. HDMI applies the phone’s saved X/Y/scale at playback only; it does not alter the converted file.

Conversion runs in the foreground and keeps the screen awake. Backgrounding, confirmed navigation away, sign-out and expiry cancel unfinished work. Native readers are released before temporary files are removed. The editor's source, framing and results last only for that editor/session; successfully uploaded files persist on the server. A killed app or failed cleanup can leave cache files until OS eviction. Physical truck mapping is still unconfirmed: this canvas does not establish which physical side each region drives or the phone's HDMI output resolution.

The `admin` / `admin` offline preview supports local selection, conversion and HDMI. It cannot list, download or save server files. Browser conversion uses canvas and a lazily loaded mediabunny encoder; browser codec availability is required, and HDMI remains unavailable.

### Converter implementation and verification

`src/features/screen/screenLayout.ts` ports the dashboard's pure placement calculations. Its rectangles drive native preview and conversion. The local `modules/screen-video` Expo module uses AVFoundation with the same Core Image compositor for iOS preview and asset-reader/writer export. Android shares a custom video effect between ExoPlayer and Media3 Transformer at the HDMI module's Media3 version (1.11.1), with encoder resolution fallback disabled. Native files stay on disk rather than being loaded wholesale into JavaScript. Session and job identifiers discard stale callbacks. Rebuild both native development apps after adding or changing this module; Expo Go cannot load it.

The iOS compositor renders black when AVFoundation requests a time with no source frame, such as an initial empty edit or an audio-only tail. These valid timeline gaps must not be treated as decoding failures. Reader/player errors still fail normally, and the export session is bounded by the original asset duration. Audio and video use separate reading/writing queues so a blocked read cannot starve the other track. Cancellation runs on a separate control queue and waits for both media queues to drain before settling the conversion promise and allowing temporary-file cleanup.

Before recording device support, compare preview and output frames against the dashboard with landscape, portrait, rotated, audio and silent MP4s; check each region's contain/cover settings, black gaps, 2304 × 512 dimensions and duration. Exercise selection cancellation, invalid/unsupported sources, cancellation during conversion and transfer, retry after download/upload failures, navigation, sign-out and expiry. With existing accounts, verify the file picker honors the server's visibility for each available role without changing roles. Check a small screen, large text, keyboard seeking in the browser, converted-video handoff and both HDMI samples. Report actual HDMI/display checks separately from simulator or build checks. Do not add automated tests or inspect logs without an explicit request.

Verification on 2026-11-19: Node 24 type checking, lint and Android/iOS/web exports passed. The Android native module and arm64 development APK built; no Android runtime device was available. iOS simulator and signed device builds passed with Swift concurrency and dependency warnings. The final signed app was installed and opened to the editor on the connected iPhone 15 Pro Max. On the simulator, landscape, portrait/silent and rotation-metadata sources converted, contain and cover settings worked independently, and converted-video HDMI handoff reached Ready to play without autoplay; returning retained the editor result. Media inspection confirmed 2304 × 512 H.264, AAC and the two-second duration for the landscape and rotated exports, with upright frames and black gaps. Browser preview/conversion, keyboard seeking, a 375px layout, cancellation with source/framing retained, the navigation warning and sign-out were exercised. No automated tests were added or modified, and no logs were inspected.

iOS frame-reading fix verified on 2026-11-19: the reported 1:51 MP4 had its first video frame at 0.04 seconds. The rebuilt app converted it completely on the physical iPhone 15 Pro Max, and cancellation followed by another complete conversion worked without losing the source, framing or previous result. The exported H.264/AAC file was 2304 × 512; an extracted frame showed all three regions and black gaps. Its video/container duration was 111.32 seconds, matching the source video track; the source container reported 111.331791 seconds. Apple decoded both original and exported audio from 0 through 111.291791 seconds, confirming that the decoded audio duration was retained. Type checking, lint, Android/iOS bundle exports and the signed iOS build passed; Swift concurrency and dependency warnings remain. No automated tests or log inspection were used.

Still unverified: Android playback/encoding on hardware, every framing combination against the dashboard, maximum system text size, unsupported-device encoders, real-account file listing/download/upload and failure retry, role visibility, and expiry/background cancellation during native encoding. No HDMI display was connected, so actual external playback, physical region mapping and HDMI lifecycle checks remain pending.

## HDMI test

1. Install a development build and sign in with an existing account.
2. Connect a video-output-capable phone through a compatible HDMI adapter. For the truck, connect to the TB60's **HDMI IN** and select its HDMI/synchronous input using the controller's existing tools.
3. Open **HDMI test** from the home screen for the flower sample, or **Truck screen video** for the included converted truck clip. Confirm that an external display and its negotiated pixel resolution appear.
4. The selected bundled sample loads automatically and waits for Play. **Truck screen video** opens `sample-10s (ecran camion).mp4`, a 2304 × 512 picture containing three screen regions. To use your own video, tap **Choose video** and select a downloaded local video in the system file picker. H.264 in an MP4 container is a useful compatibility baseline. Cloud-provider files must finish downloading/copying before playback can prepare.
5. Tap **Play**. Video loops silently at the saved placement, defaulting to top-left 1:1 pixels; anything beyond the HDMI frame is cropped. There is no phone preview. Pause retains the external frame; Stop resets playback and makes the external output black.
6. While playing, tap **Dim phone screen** to cover the phone with black at minimum brightness while HDMI continues playing. Press and hold anywhere for one second to show controls and restore brightness. Ordinary taps do nothing; screen-reader users can activate the overlay with a double-tap. Android Back also wakes the controls.

The phone stays awake while playing, buffering or showing the calibration grid unless you lock it manually. Buffering displays **Buffering…**, retains Pause and Stop controls, and continues playback when the native player is ready. It does not restart initial file preparation. On iPhone, playback started with Play continues on HDMI when switching apps or locking the phone. The iOS module uses the media background mode, an active playback audio session with mixing, and AVPlayer’s `continuesIfPossible` background policy; video remains muted. It keeps the external video layer attached and visible. Android 11+ continues when switching apps using its mediaPlayback service and independent display context; older versions pause in background. Manual lock may blank HDMI. Android does not acquire audio focus. Opening the file picker, disconnecting HDMI, native interruptions, or unexpected pauses require an explicit Play afterward. Returning never restarts paused or stopped playback. Back, navigation away from the HDMI test, sign-out, and session expiry end the test and release the native player, including any pending preparation. The one-hour session expiry still applies: both platforms receive the login deadline and enforce it natively even while JavaScript timers are suspended. Keep-awake warnings remain through buffering and disappear when playback pauses, stops, fails, or ends.

Android retains the attached presentation while its display remains eligible, valid, and visible, even if another display appears or enumeration order changes. When a replacement is needed, the eligible display with the lowest ID is selected, excluding the phone's built-in displays. The replacement starts black and requires Play.

Use **Dim phone screen** to keep the controls covered during playback. iPhone can also be locked while HDMI continues; Android must remain unlocked. A new dim operation is available only while actually playing, but buffering preserves an existing or pending dim operation and keeps the phone awake. The controls automatically return and brightness restoration is attempted when playback pauses, stops or fails, HDMI disconnects, the app goes into the background, or you leave the screen (including sign-out and session expiry). Brief iOS overlays that only make the app inactive keep dim mode enabled. On iOS, waking restores the saved brightness; Android returns to the system brightness setting. If dimming fails, the controls stay visible and an error appears.

Leaving iPhone foreground mode restores the phone brightness and closes the dim overlay without pausing HDMI. Dim mode uses the native `expo-brightness` module, so rebuild the development app after adding or updating it. It is unavailable on web. If the app is killed while dimmed on iOS, brightness may stay low until the phone is next locked. For unattended truck use, Guided Access on iOS or app pinning on Android can keep controls restricted; keep the phone connected to a charger.

Imported files are copied into app cache; your original file is not modified or deleted. Both included samples are shared app assets and are never deleted by HDMI session cleanup. A new selection is committed only after native preparation confirms that it is playable; controls remain busy during preparation. A failed replacement clears the selection and removes its imported copy and any detached previous imported copy. A later decoder failure also clears the selection after releasing the video. Canceling the picker retains the previous selection, paused. A preliminary Pause failure is reported separately and does not prevent opening the picker.

Replacing a file or leaving the test removes its imported copy only after native detachment is confirmed. Disposal waits for startup, releases the player, and retries release once if it fails. If release still fails, copies are retained and a cleanup warning appears on the next visit to the HDMI test. An unexpected preparation or teardown failure requires leaving and reopening the test; its copies are retained until release succeeds. File choice and playback do not persist across launches; every new HDMI test starts with the sample selected by its home-screen button and never autoplays. If the app is terminated abruptly or cache deletion fails, the OS may retain the temporary copy until cache eviction.

On both platforms, `start(sessionId, expiresAt)` accepts the login expiry in epoch milliseconds, or null for the offline preview. The native `prepare(sessionId, uris, startIndex = 0)` promise resolves on playable readiness, rejects after media failure cleanup, and is cancelled by replacement, release, or module destruction. Status events reserve `loading` for initial preparation and report `buffering` only while an explicit Play request is waiting for media. Pause, Stop, interruption, disconnection, and backgrounding on Android below API 30 clear that request; late native events cannot resume it or replace the stopped/error state. Rebuild the development app after changing this native contract; a JavaScript reload alone is insufficient.

The HDMI test uses one local video and one external display; Playlist HDMI uses an ordered list on the same native player. Neither streams from the API, sets custom HDMI timings, nor configures TB60 mapping or scaling. Use **Ecrane camioane** to compose the three regions before opening the player. The displayed resolution is the output mode negotiated by the phone and adapter, not the dimensions of the video file. USB-C alone does not guarantee video-output support; screen-mirroring-only adapters may not expose a separate display.

### HDMI placement and calibration

**HDMI placement** on the test screen shows the negotiated mode, offered mode sizes (marking 2304 × 512 when present), current video display size and any cropped edges. Default X/Y/scale is **0, 0, 100%**: one video pixel maps to one HDMI pixel. X/Y support integer −4096…4096 offsets, numerical entry and −64/−8/−1/+1/+8/+64 steps. Scale supports 10–400%, numerical percentages, 100%, fit width and fit height. Fit preserves X/Y. **Reset to 1:1 at 0,0** restores defaults. Use **Apply** for a numeric entry; step buttons and presets apply immediately.

**Calibration grid** hides the video under a grid drawn in native HDMI pixels: 64 px lines, brighter 128 px lines, coloured 512 px lines, `x,y` labels every 128 px and a 2 px frame border. It works without a loaded video. The grid stays fixed while X/Y/scale adjust video placement; turn it off to check the picture. Video playback intent is retained while the grid is visible. Stop, a terminal error or session expiry clears it; the toggle is not persisted.

`src/features/hdmi-placement/` stores validated placement in `Paths.document/hdmi-placement.json`, through a temporary file and serialized writes. Browser storage uses `localStorage`, but HDMI stays unavailable there. Placement is a **per-phone** setting shared by every account's test and playlist. Both apply it immediately after native `start` and before preparing videos; controls apply changes live. Playlist HDMI shows X/Y and scale beside the display size. Editor geometry, conversion, uploaded files and editor output-resolution settings are unaffected.

The native session API adds `setPlacement(id, x, y, scale)` and `setPattern(id, enabled)`, rejecting stale/expired sessions and invalid placement. Status adds `video` (display size or null), `placement`, read-only `modes`, and `pattern`. iOS observes each current item's `presentationSize`, including queue advances, and uses manual pixel-to-point layout with `.resize` and overscan compensation disabled (checked in the iOS 27 SDK). Android accounts for pixel aspect ratio and uses fixed pixel dimensions with top-left gravity and translation. Neither selects an HDMI mode.

At 1920 × 1080, the 2304 × 512 sample at defaults must warn **384 px cut off on the right**. Use the [truck calibration procedure](../hardware_docs/Phone-HDMI-Playback.md#hdmi-placement-and-calibration) to record each panel's corner coordinates and controller transform. Test a 2304 × 512 custom EDID in ViPlex's **Monitor & Control → Current Source → HDMI EDID/Scaling** to retain the full canvas at 1:1; the phone/adapter must actually negotiate it.

Rebuild after these native changes. On iOS Simulator add a 1920 × 1080 external display; on Android use “Simulate secondary displays”. Check the default crop, grid labels/border, positive and negative offsets, scale presets and input validation, Stop, reconnect, queue advances with different dimensions, saved settings on reopening and the playlist summary. Simulated displays do not validate the TB60's mapping; the owner must record the actual grid readings on the truck.

Placement verification on 2026-11-26: Node 24 type checking, lint and Android/iOS/web exports passed; Android debug APK and the iOS simulator development app built successfully. The rebuilt simulator app loaded the 2304 × 512 sample without autoplay. In its exposed 720 × 480 external mode, Play, X +64, Y −64, fit width (31.25%), calibration-grid status, Stop clearing the grid, invalid X=4097 rejection, reset, persistence after reopening and the playlist's saved-placement summary were exercised. The browser test and playlist retained their unavailable states. The simulator controls were restored to X=0, Y=0, 100%.

Limits of this verification: the current Device Hub/runtime continued reporting a 720 × 480 mode after requesting 1920 × 1080; external video/grid pixels and the exact 384 px crop at 1920 × 1080 were not visually verified. Android installed on the emulator, but its UI was not accessible through the available controls, so secondary-display runtime checks remain pending. Mixed-size playlist transitions and real truck corner readings remain pending. Physical iPhone installation was blocked by the locked phone and then deferred at the owner's request. Builds retained existing dependency/concurrency warnings; no tests were added and no application/device/Metro logs were inspected.

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

### Included truck-screen video

The home screen's **Truck screen video** button opens `/hdmi-test?sample=truck-screen` and prepares `assets/truck_screen.mp4` using the same HDMI player. Press **Play** after connecting the display; Pause, Stop, looping, dimming and session cleanup work as in the regular HDMI test. Reopening the regular **HDMI test** still loads the flower sample. The supplied filename remains visible in the player.

This is the user's `sample-10s (ecran camion).mp4`, copied unchanged on 2026-11-19: 41,837,676 bytes, H.264 at 2304 × 512, with AAC audio (muted during HDMI playback). Its SHA-256 is `6ee88a6a3f34136495cb3e84a7ab121370a3763e6c307845b729572b15a7170a`. The source clip is [Samplelib's 10-second MP4](https://samplelib.com/mp4/sample-10s.mp4), converted by the admin frontend into the three-region truck layout. [Samplelib's license](https://samplelib.com/license.html) permits use and modification.

Both videos are registered with the `expo-asset` config plugin. The underscore in `truck_screen.mp4` keeps its Android raw-resource name valid. Regenerate and rebuild native projects when changing this asset configuration; development sessions also serve the asset through Metro. Bundling the 2304 × 512 video does not change the phone's HDMI mode or confirm the truck's physical region mapping.

Truck-video integration verified on 2026-11-19: type checking, lint, Android/iOS/web exports, and the signed iPhone build passed. The installed app opened on the connected iPhone 15 Pro Max; the new home-screen button loaded the supplied filename and reached Ready to play. The first development load took time to transfer the 42 MB asset through Metro. The regular HDMI test still loaded the flower sample. Browser navigation for both buttons worked and showed the native-player requirement. No external display was connected, so HDMI playback of this clip and physical region mapping remain unverified. No automated tests were added or modified.

### Playlist HDMI

Open **Playlist HDMI** from Home. Add multiple MP4s from the phone, or download
MP4s from **Fișiere** (requires a real account with access to those files). The
local preview account supports phone imports only. The whole list loops in order;
use Redă/Pauză, Oprește, Anterior/Următor, reorder arrows and Elimină. Every edit
requires Redă again and preserves the current item where possible. Oprește blacks
out HDMI and rewinds to item zero. Navigation away ends playback.

Each account has its own permanent `Documents/hdmi-playlist/<userId>/playlist.json`
and `videos/<id>.mp4`. Restarting or signing out does not erase the list. Removal
waits for native file readers to detach. iOS marks the playlist directory excluded
from backup and permits its videos to be read after the first unlock. There is no
backend playlist endpoint; server downloads remain local copies.

Rebuild the native app for the new playlist API and Android manifest/service.
iPhone background playback and native session expiry also apply to playlists.
On Android 11+ a mediaPlayback foreground service keeps playback active when the
activity backgrounds, with an ongoing **Playing on HDMI** notification that opens
the app. No runtime notification prompt is added; on Android 13+ the notification
may be absent from the drawer without permission. A local wake lock and the
presentation's keep-screen-on flag prevent automatic sleep while playing. Earlier
Android versions retain foreground-only playback. Reconnecting in background
waits for the app to return and requires Play. **Manual locking can still blank
HDMI on Android; use Dim phone screen until the phone/adapter has been verified.**

Playlist implementation verified on 2026-11-26: Node 24 type checking and lint
passed, as did Android/iOS/web exports, Android HDMI Kotlin compilation and
manifest processing, and an unsigned iPhone app build. Browser local preview
sign-in, Playlist HDMI's unavailable state, reload returning to sign-in, and
navigation through the existing screen editor and HDMI test worked. Xcode emitted
existing toolchain/dependency warnings. Installing the signed build on the paired
iPhone was blocked because it needed unlocking for development services; hardware
checks were left pending at the user's request. No Android device was connected.
Persistent imports, server downloads with a real account, actual multi-item HDMI
output, background/lock playback, session expiry and adapter compatibility remain
unverified on hardware. No automated tests were added or modified.

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
- While dimmed, disconnect HDMI, switch apps, and leave the test using Back after waking: controls return and brightness is restored. Switching apps on iPhone and Android 11+ must keep HDMI moving; older Android must pause. Also check sign-out and session expiry cleanup, including during a pending dim operation.
- The dim button is disabled unless playback is playing and controls are not busy. It is absent on web.
- Pause, resume, and Stop; Stop must black out HDMI and the next Play must start from the beginning.
- During buffering, confirm that Pause and Stop still work, an existing dim overlay and keep-awake remain active, and playback recovers without another Play. Starting a new dim operation must remain disabled until video is playing.
- Interrupt native playback while dimmed: controls and brightness return, status says Paused, and ending the interruption does not resume playback. Check that late player events after Stop or a decoder failure cannot change the terminal state.
- On Android, add or change another presentation display while playing: the current valid output must remain selected. Removing it may select another eligible display, but the new output stays black until Play.
- Disconnect/reconnect on either platform: require an explicit Play to resume. On Android 11+, go Home and switch apps: HDMI must keep moving, with the playback service active. Verify the notification opens the app (also test denied notification permission), and the phone does not time out. Check manual lock separately: record whether HDMI blanks and use dimming if it does. Older Android must pause when backgrounded. On iPhone, switch apps and fully lock the phone for at least ten minutes: HDMI must keep moving across loop boundaries, with the sample and an imported MP4. Unlock/return must preserve playing, paused, or stopped state without restarting the video. Verify expiry stops output while locked, and test an imported MP4 without an audio track.
- Open and dismiss Control Center or a brief system alert on iOS while dimmed: playback continues and dim mode remains enabled unless the app actually backgrounds.
- Leave during file selection or preparation, reopen, sign out, and allow the session to expire: no orphaned playback or retained selection.
- Playlist: add several device MP4s and server MP4s; verify download progress/cancel, preview-account restrictions, up/down reorder and removal. Kill and relaunch, sign in to the same account, and confirm order and files persist. Switch accounts and confirm isolation.
- Playlist: loop at least twice through every item; check next/previous with playing, paused and stopped intent, including wrapping. Remove the playing item and the last item; verify readers detach before file deletion, output stays black, and Play is required after every edit.
- Playlist: add an unsupported later item and confirm the error names it; on iOS preflight fails before playback, while Android detects decoder support on transition. Verify recovery by removing the item or retrying preparation.
- Playlist: background/lock the iPhone across item boundaries, including silent MP4s. Let the session expire while backgrounded on each platform: output and the Android service must stop. Pause, Stop, HDMI removal and leaving the screen must also remove the Android notification.
- Playlist: leave or sign out during picker/download/preparation; no stale session may resume or delete permanent playlist files. Reconnect HDMI while backgrounded and verify return + Play is required.
- Repeat on the actual TB60 installation and confirm its input/mapping separately.

Software verification on 2026-11-18: type checking, Oxlint, and Android/iOS/web bundle exports passed. The Android HDMI module compiled, and unsigned iPhone and simulator builds completed with the latest HDMI source; Xcode emitted toolchain/dependency diagnostics. On the rebuilt iOS simulator, local preview sign-in, HDMI screen entry, picker cancellation, and leaving/reopening the screen worked. Browser preview sign-in, the unavailable HDMI state, Back, and sign-out worked. No automated tests were added or modified. External playback, buffering recovery, interruptions, multi-display switching, and ten-minute looping were not exercised; physical HDMI/TB60 checks were deferred at the user's request.

Record actual results here after connecting hardware; no physical device/adapter combination is certified by this change:

| Platform | Phone / OS | Adapter / cable | HDMI mode | 10-minute loop | Reconnect / lifecycle | TB60 result |
| --- | --- | --- | --- | --- | --- | --- |
| Android | Pending | Pending | Pending | Not verified | Not verified | Not verified |
| iPhone | Pending | Pending | Pending | Not verified | Not verified | Not verified |
