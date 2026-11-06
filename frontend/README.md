# Camioane App frontend

React, TypeScript, and Vite administrator dashboard connected to the Express API and PostgreSQL. Administrators can list, create, edit, and delete accounts and assign Admin, Operator, Driver, and User roles. Management access requires a currently valid Admin role; the other roles currently have account/profile access.

## Development

Start the backend and provision an administrator using `npm run admin:bootstrap` from `../backend/`; see its README. Then, from `frontend/`:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Development and preview use port 5173 with strict port selection, matching the backend's default CORS origin.

The development API URL defaults to `http://localhost:3000`. To customize it, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`. Restart Vite after environment changes. The value is public and can be an HTTP(S) API base URL or a same-origin proxy path; never put private keys or database credentials in it.

For a production build, explicitly set `VITE_API_BASE_URL` to the deployed API URL (or configured same-origin proxy path) before building:

```sh
npm run build
npm run lint
npm run preview
```

Production has no localhost fallback. For a local production preview, build with `VITE_API_BASE_URL=http://localhost:3000` in `.env.local`. Configure the backend's `FRONTEND_ORIGIN` to the actual frontend origin. Production hosting must provide SPA fallback to `index.html` for application routes, and use HTTPS for the frontend and API.

## Authentication and navigation

- `/` redirects to login or the appropriate signed-in view.
- `/login` accepts existing accounts only; account creation is administrator-controlled.
- `/files` lists, uploads, previews, downloads and deletes uploaded images and videos; it requires administrator access.
- `/files/:fileId/edit` opens the administrator-only video editor for one uploaded MP4.
- `/users` requires administrator access.
- `/routes` opens the administrator-only route builder.
- `/profile` lets every signed-in account, whatever its role, set or remove its own profile picture.
- `/access-denied` explains missing management access and lets Admin accounts retry their access check. Successful revalidation returns to `/users`; sign-out remains available in navigation.

Signed-in views share a sidebar with role-aware navigation, the verified account's picture, email and role, a Profile link, and sign-out. Below 768px, navigation opens in a modal drawer with keyboard focus containment, Escape/backdrop dismissal, and focus restoration. A skip link moves keyboard users directly to the page content. Login and session-verification screens keep their standalone layout.

The assigned role name is separate from verified management access. After `GET /users/me` verifies an Admin account, one shared `GET /users` query checks administrator access and supplies the Users table. `/dashboard`, `/files` (and its video editor), `/users` and `/routes`, including their navigation links, require a successful access check. Non-admin accounts never request the administrator user list.

Access is rechecked on page entry, window focus/tab visibility, reconnect, and manual retry, without polling. A `403` from a list or management mutation discards cached users and redirects to account access without signing out. Inactive, future, and expired Admin roles still allow login/profile access; reactivating the shared role allows access to be restored with the same unexpired session. The UI cannot distinguish the reason for denial because the API exposes role names only, not IDs, active flags, or validity dates. Role changes become visible at the next access check or management API response.

The one-hour bearer token and expiry persist under `camioane.session.v1` in local storage, so refreshes and browser reopening preserve an unexpired session. Every restored session is validated through `GET /users/me`. Browser storage never contains passwords, user lists, or a trusted role.

Expiry or a protected API 401 clears the session and private query cache. Logout and account replacement cancel outstanding requests; other tabs synchronize through storage events. An unavailable local-storage API falls back to in-memory sign-in with a notice. Failed session/access checks show retry without discarding the session and block management views until verification succeeds. There are no refresh tokens.

Email, password, or role changes revoke the affected account's existing sessions. Editing your own email/password signs you out with an explanation. Self-deletion and self-demotion are disabled in the UI and rejected by the backend.

## Action notifications

Action outcomes use the shared in-memory toast system. Toasts appear at the bottom right (across the bottom on phones), survive navigation, and clear on reload or any session change. There is no notification history or backend delivery. Dashboard toasts identify their sample actions.

Components obtain a session-bound callback with `useNotify` from `src/lib/useNotify.ts`:

```tsx
const notify = useNotify()

// Call after the operation succeeds, preserving existing session and access checks.
const id = notify({ variant: 'success', message: 'User updated.' })
notify({ variant: 'error', message: "Couldn't delete the file. Please try again." })
notify({
  variant: 'success',
  message: 'Saved the edited video to Files.',
  action: { label: 'View files', onClick: () => { void navigate({ to: '/files' }) } },
})
```

`NotificationInput` supports `success`, `error`, `warning`, and `info`, a plain-text message, an optional duration in milliseconds (`0` means persistent), and an optional action. Actions always persist until acted on or dismissed. The callback returns an ID, or `undefined` for a stale session or empty message. `dismissNotification(id)` and `clearNotifications()` are available from `src/lib/notifications.ts`; non-component code can call `notifyForSession(input, revision)` with the revision captured when its work began. Do not capture a new revision after an asynchronous operation finishes.

Three toasts display at once, with the rest queued in arrival order. Identical variant/message pairs return the existing ID without restarting its timer. Success/info last five visible seconds and warning/error eight by default. Timers pause on hover, keyboard focus, hidden tabs, and native modal dialogs; queued notifications start their timers only on display. Modal dialogs defer toast presentation and announcements until they close. Notifications announce once without moving focus.

Keep validation, form submission failures, query errors, authentication notices, upload/export progress and retries, and route-builder status inline. Do not also toast those messages. Emit outcomes in action handlers, never in query-state effects or a global API interceptor. Only explicit user cancellations produce info toasts; component cleanup and stale-session requests remain silent.

## User management

The table shows each account's picture and email, role, and row actions. Add/Edit uses the existing inline form. Emails are normalized and checked for duplicates; the backend remains authoritative. New passwords are required, while an empty edit password is omitted. Passwords contain 12–128 Unicode characters with spaces preserved.

Save and Delete update the table only after server success and refresh the shared access/users query. Requests show pending feedback and disable repeated submissions. Form values remain after ordinary save failures; losing management access closes the management view. Delete asks for confirmation naming the account. Loading, empty, verification errors, invalid input, and access-denied states are explicit. Role assignment always uses the four enum names, defaults to User for new accounts, and does not filter roles by their validity; the backend resolves assignments.

TanStack Query owns API data, Zustand owns session state, and TanStack Router owns navigation. The API client and shared user types live in `src/lib/`; session behavior lives in `src/auth/`. The Users page and its form remain under `src/pages/UsersPage/`. Styling stays in plain CSS.

The previous `camioane.users-demo.v1` local-storage data is neither read, modified, nor imported. Demo users are not backend accounts.

## Profile pictures

Open **Profile** at the bottom of the sidebar, or visit `/profile`. Every role can use it. Administrators can also change anyone's picture from **Edit** on the Users page; there the picture saves on its own, straight away, apart from the form's Save.

- **Upload picture** (or **Change picture**) opens a picker limited to JPEG, PNG and WebP and uploads the picked file at once with `PUT /users/:id/avatar`, showing the shared upload progress with Cancel. An empty file, another declared type, or a file over 10 MiB is refused before any byte is sent; the API still checks the content. It decodes the image, applies its orientation, crops it to a centred 512×512 square and stores it as WebP without metadata.
- **Remove picture** asks first, then calls `DELETE /users/:id/avatar`.
- A change rewrites the cached signed-in account and the cached user list from the API's reply (`replaceCachedUser` in `src/auth/currentUser.ts`), so the sidebar and the Users table update without a reload. Picture changes don't end any session.

Every user from the API carries `avatar: { url, updatedAt } | null`. The decoder accepts only the user's own `/users/<id>/avatar` path, because the bearer token goes wherever it points. `Avatar` (`src/components/`) fetches the picture with the token, keyed on `updatedAt` so a new upload is a new request and an unchanged picture is fetched once, and shows it through an object URL. Without a picture, or while it loads or if it fails, it shows the email's first letter.

## Files

Open **Files** in the sidebar, or visit `/files` as an administrator. The page uses the backend's `/files` API, so an active admin sees every user's files, newest first, 50 per page with Previous and Next. Each row shows the name and type, the owner's email from the shared users query ("Deleted user" once the account is gone), the local upload day and time, and the size in decimal units.

- **Upload file** opens a picker limited to JPEG, PNG, WebP and MP4, one file at a time. A file whose declared type is something else, or that is empty, is refused before any byte is sent; the API still checks the content of everything else. Uploads go through `XMLHttpRequest` in `src/lib/api.ts`, because `fetch` cannot report upload progress. The block shows "12.4 of 48.0 MB · 26%", then "Checking and saving…" once every byte is sent, with Cancel. Leaving the page during an upload asks first and cancels it. Failures stay in the block; Retry appears only for network, conflict and server errors.
- **Preview** opens a dialog that fetches that one file with the bearer token and shows the image or plays the video, with Download reusing the loaded file. **Download** fetches the file and saves it under its original name. Both load the whole file into memory: the API has no thumbnails or range playback.
- **Edit** (videos only) opens the video editor described below.
- **Delete** asks for confirmation naming the file. The API deletes for its owner too.

Formats, sizes and owners are not filtered or searched: the API supports only `limit` and `offset`.

## Video editor

Open it with **Edit** on a video row in Files, or visit `/files/<file id>/edit` as an administrator. The page is lazy-loaded and cuts one uploaded MP4:

- The preview plays the edit, not the source: it jumps over the cuts. The video loads whole into memory, like Preview, because the API has no range playback.
- The timeline uses [`@xzdarcy/react-timeline-editor`](https://github.com/xzdarcy/react-timeline-editor). Each kept segment is a bar on one row, packed end to end, so the timeline always shows the exported video. Drag a bar's edges to trim it, drag the bar to reorder it, click the ruler or drag the playhead to seek, and use **Split at playhead**, **Delete segment**, **Undo**, **Redo** (also Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z), **Reset** and the zoom buttons.
- The table under the timeline repeats each segment with its source in and out points in seconds, which can be typed, and Earlier, Later and Delete buttons. Together with the **Playhead** slider under the preview, it is the keyboard route through the editor; the timeline itself is pointer-only.
- **Export to Files** renders the edit in the browser with WebCodecs, through [mediabunny](https://mediabunny.dev/) (loaded only when you export). It writes an MP4 with H.264 video and AAC sound, or Opus where the browser can't encode AAC (as in Chromium on Linux). Then it uploads the result through `POST /files` as `<name> (edited).mp4`, with the same progress, Cancel and Retry as an upload. The original file is never changed. Browsers without `VideoEncoder` or an H.264 encoder can edit but not export, and the page says so.
- Leaving with an export running, or with an edit that hasn't been exported, asks first.

The API has no `GET /files/:id`, so the editor finds the file's name and type in the Files pages already cached, or else pages through `GET /files?limit=100` until it finds the ID. A missing or malformed ID shows "This file isn't in Files any more, or the link is wrong."

## Route builder

Open **Route builder** in the sidebar, or visit `/routes` while signed in as an administrator. The page lazy-loads MapLibre GL JS 6 and the MapLibre Directions 0.10 plugin, including MapLibre's Vite worker and CSS.

- Click the map to add ordered stops; drag a point to move it, drag the route to insert a stop, or click a point to remove it.
- Add or edit latitude/longitude using the labeled coordinate forms. The stop list also provides keyboard-accessible move-up, move-down, remove, and show-on-map actions.
- Use **Fit route**, **Reverse**, **Undo**, or **Clear** to adjust the plan. **Undo** restores the stops removed by the last clear or removal. Distance and estimated driving time come from the routing response. Editing during a calculation replaces it. A failed calculation clears the previous summary, hides the previous route, names the cause (stop placement, timeout, connection, or a busy or unavailable service), and offers a retry action.
- Stops must be within 1 km of a routable road; the request limits snapping so regional providers cannot silently substitute a distant location.
- **Export GeoJSON** downloads the calculated road geometry and ordered stop points, with distance in metres and duration in seconds. The stops are kept in `sessionStorage` under `camioane.route-draft.v1`, tagged with the signed-in user's ID. They survive navigation, refresh, and signing in again in the same tab, and are discarded when the tab closes. No route-save API exists yet.

The map opens over Romania and defaults to [OpenFreeMap Positron](https://openfreemap.org/quick_start/). Routing uses the [Directions plugin](https://github.com/maplibre/maplibre-gl-directions) with the public OSRM demo endpoint and the `driving` profile. These routes do **not** account for truck dimensions, weight, hazardous goods, traffic, breaks, or truck-specific access restrictions.

Optional public configuration (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_MAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/positron` | MapLibre-compatible style JSON URL |
| `VITE_ROUTING_API_URL` | `https://router.project-osrm.org/route/v1` | OSRM-compatible routing base URL, without `/driving` or coordinates |

For production, configure a routing service with suitable capacity and availability rather than relying on the public demo. The browser directly requests map tiles/styles and sends stop coordinates to the configured routing service; that service must allow the frontend's origin through CORS. Never put private credentials in `VITE_*` variables. Map attribution stays visible. Map loading and routing both require internet access; routing times out after 15 seconds and map load failures offer retry. WebGL must be available in the browser.

## Verification

Run `npm run build` and `npm run lint`. There is no frontend test runner or `npm test` script; no test files were added.

Use disposable development accounts to verify login/logout, refresh and reopening, cross-tab sign-out, expiry, non-admin denial, create/edit/delete and persistence, role changes, self-edit sign-out, duplicate/invalid emails, password boundaries, and API outage/retry. Check keyboard focus, pending controls, cancellation, and desktop/tablet/phone layouts. Do not inspect browser or application logs unless explicitly requested.

Use controlled browser API responses to check all four roles, Admin lifecycle denial and reactivation, denial during edits or route building, access-query failures, focus/reconnect rechecks, and late responses after denial or session replacement. Do not change shared role configuration in the working database for frontend verification.
