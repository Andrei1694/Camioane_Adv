# Camioane App frontend

A minimal React, TypeScript, and Vite user management prototype. The Users page
supports adding, editing, and deleting demo users. It runs independently of the
backend and has no authentication or API integration.

## Development

From `frontend/`:

```sh
npm ci
npm run dev
```

Use the URL printed by Vite. To verify and build the frontend:

```sh
npm run build
npm run lint
```

`npm run preview` serves the production build. There is no test runner or
`npm test` script.

## Demo behavior

- A new browser origin starts with `demo.admin@example.com`,
  `demo.dispatcher@example.com`, and `demo.driver@example.com`. These are fictional
  samples, not backend accounts or assigned roles.
- Add user opens an inline form; Edit opens the same form for the selected email.
  Save applies the change, Cancel discards it, and Delete asks for confirmation.
- Emails are trimmed, lowercased, validated, and unique. Their maximum length is
  254 characters, matching the backend. The list is sorted by email.
- Passwords are required when adding and optional when editing. Nonempty
  passwords must contain 12–128 Unicode characters, including preserved spaces.
  Passwords are demo inputs only: they are discarded after submission or cancel,
  never stored or transmitted, and do not change any real account.
- Changes persist in local storage under `camioane.users-demo.v1` as an array of
  `{ "email": "..." }` objects. Deleting every user saves an empty array, which
  stays empty on refresh. Sample users appear only when the key is absent.
- Invalid stored data opens an empty list with a notice; the next successful
  save replaces it. Unavailable storage leaves CRUD usable in memory and displays
  a notice that changes may be lost on refresh. Browser data is scoped to the
  origin, so another hostname or port has its own list.

React state owns the page and form. The page, reusable create/edit form, email
validation, and local-storage helper live under `src/pages/UsersPage/`. Styling
uses plain CSS with a single-column phone layout, semantic table, labeled inputs,
visible focus, and status feedback. No dependencies were added for this prototype.

## Manual verification

Check adding and editing, cancel without changes, duplicate/invalid emails,
password boundaries, both delete confirmation choices, and the empty list.
Refresh after changes and after deleting all users. Check malformed/unavailable
storage recovery, keyboard focus, and desktop/tablet/phone layouts. No browser or
application logs are needed for these checks.
