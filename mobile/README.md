# Camioane Driver (mobile)

An Expo (React Native) app for the drivers and operators of the LED-screen trucks. Today it signs in with an existing account, keeps the session in the device's secure storage, and signs out. The backend has no route, shift or fleet API yet, so the home screen says assignments aren't available rather than showing invented data.

Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router, TanStack Query and Zustand.

## Accounts

There is no registration. An administrator creates accounts on the web dashboard's Users page (`../frontend`) and gives them the Driver or Operator role. Admin and User accounts can sign in, but the app only tells them it's for drivers and operators and offers sign-out.

## Development

Requirements: Node.js 24+ and npm. To run the app, use either the Expo Go app on a phone on the same Wi-Fi as your computer, or an iOS Simulator (macOS with Xcode) or Android emulator (Android Studio).

Start the backend first; see `../backend/README.md`. Then, from `mobile/`:

```sh
npm ci
npm start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `i` or `a` to open a simulator or emulator.

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

Before a production build:

- Set `EXPO_PUBLIC_API_BASE_URL` to the deployed API's HTTPS URL. Release builds have no fallback and refuse plain HTTP.
- Confirm the placeholder `ios.bundleIdentifier` and `android.package` (`com.camioane.driver`) in `app.json`. They can't change after the app is published.

The icon and splash come from `../assets/app-icon/`. The iOS icon is flattened onto white because the App Store rejects icons with transparency.
