# Camioane App frontend

React, TypeScript, and Vite administrator dashboard connected to the Express API and PostgreSQL. Administrators can list, create, edit, and delete accounts and assign User/Admin roles.

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
- `/access-denied` explains missing management access and offers sign-out.

The one-hour bearer token and expiry persist under `camioane.session.v1` in local storage, so refreshes and browser reopening preserve an unexpired session. Every restored session is validated through `GET /users/me`. Browser storage never contains passwords, user lists, or a trusted role.

Expiry or a protected API 401 clears the session and private query cache. Logout and account replacement cancel outstanding requests; other tabs synchronize through storage events. An unavailable local-storage API falls back to in-memory sign-in with a notice. Network failures show retry without discarding the session. There are no refresh tokens.

Email, password, or role changes revoke the affected account's existing sessions. Editing your own email/password signs you out with an explanation. Self-deletion and self-demotion are disabled in the UI and rejected by the backend.

## User management

The table shows email, role, and row actions. Add/Edit uses the existing inline form. Emails are normalized and checked for duplicates; the backend remains authoritative. New passwords are required, while an empty edit password is omitted. Passwords contain 12–128 Unicode characters with spaces preserved.

Save and Delete update the table only after server success and refresh its query. Requests show pending feedback and disable repeated submissions. Form values remain after failures. Delete asks for confirmation naming the account. Loading, empty, stale-data errors, invalid input, and access-denied states are explicit.

TanStack Query owns API data, Zustand owns session state, and TanStack Router owns navigation. The API client and shared user types live in `src/lib/`; session behavior lives in `src/auth/`. The Users page and its form remain under `src/pages/UsersPage/`. Styling stays in plain CSS.

The previous `camioane.users-demo.v1` local-storage data is neither read, modified, nor imported. Demo users are not backend accounts.

## Verification

Run `npm run build` and `npm run lint`. There is no frontend test runner or `npm test` script; no test files were added.

Use disposable development accounts to verify login/logout, refresh and reopening, cross-tab sign-out, expiry, non-admin denial, create/edit/delete and persistence, role changes, self-edit sign-out, duplicate/invalid emails, password boundaries, and API outage/retry. Check keyboard focus, pending controls, cancellation, and desktop/tablet/phone layouts. Do not inspect browser or application logs unless explicitly requested.
