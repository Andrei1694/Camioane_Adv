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
- `/users` requires administrator access.
- `/routes` opens the administrator-only route builder.
- `/access-denied` explains missing management access and lets Admin accounts retry their access check. Successful revalidation returns to `/users`; sign-out remains available in navigation.

Signed-in views share a sidebar with role-aware navigation, the verified account email and role, and sign-out. Below 768px, navigation opens in a modal drawer with keyboard focus containment, Escape/backdrop dismissal, and focus restoration. A skip link moves keyboard users directly to the page content. Login and session-verification screens keep their standalone layout.

The assigned role name is separate from verified management access. After `GET /users/me` verifies an Admin account, one shared `GET /users` query checks administrator access and supplies the Users table. Both `/users` and `/routes`, including their navigation links, require a successful access check. Non-admin accounts never request the administrator user list.

Access is rechecked on page entry, window focus/tab visibility, reconnect, and manual retry, without polling. A `403` from a list or management mutation discards cached users and redirects to account access without signing out. Inactive, future, and expired Admin roles still allow login/profile access; reactivating the shared role allows access to be restored with the same unexpired session. The UI cannot distinguish the reason for denial because the API exposes role names only, not IDs, active flags, or validity dates. Role changes become visible at the next access check or management API response.

The one-hour bearer token and expiry persist under `camioane.session.v1` in local storage, so refreshes and browser reopening preserve an unexpired session. Every restored session is validated through `GET /users/me`. Browser storage never contains passwords, user lists, or a trusted role.

Expiry or a protected API 401 clears the session and private query cache. Logout and account replacement cancel outstanding requests; other tabs synchronize through storage events. An unavailable local-storage API falls back to in-memory sign-in with a notice. Failed session/access checks show retry without discarding the session and block management views until verification succeeds. There are no refresh tokens.

Email, password, or role changes revoke the affected account's existing sessions. Editing your own email/password signs you out with an explanation. Self-deletion and self-demotion are disabled in the UI and rejected by the backend.

## User management

The table shows email, role, and row actions. Add/Edit uses the existing inline form. Emails are normalized and checked for duplicates; the backend remains authoritative. New passwords are required, while an empty edit password is omitted. Passwords contain 12–128 Unicode characters with spaces preserved.

Save and Delete update the table only after server success and refresh the shared access/users query. Requests show pending feedback and disable repeated submissions. Form values remain after ordinary save failures; losing management access closes the management view. Delete asks for confirmation naming the account. Loading, empty, verification errors, invalid input, and access-denied states are explicit. Role assignment always uses the four enum names, defaults to User for new accounts, and does not filter roles by their validity; the backend resolves assignments.

TanStack Query owns API data, Zustand owns session state, and TanStack Router owns navigation. The API client and shared user types live in `src/lib/`; session behavior lives in `src/auth/`. The Users page and its form remain under `src/pages/UsersPage/`. Styling stays in plain CSS.

The previous `camioane.users-demo.v1` local-storage data is neither read, modified, nor imported. Demo users are not backend accounts.

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
