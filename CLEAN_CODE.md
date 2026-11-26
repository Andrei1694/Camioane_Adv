# Clean Code

This guide defines the shared function style for JavaScript and TypeScript in
this repository. Follow it when adding or modifying functions in any package.
Keep the package-specific formatting, imports, types, and verification rules in
the applicable `AGENTS.md` and `CLAUDE.md`. Existing code is not a reason to start
an unrelated style refactor.

## Use declarations for named functions

Use `function` or `async function` declarations for named functions, including
local helpers, event handlers, React components, custom hooks, and exported
functions. Do not assign a standalone arrow function or function expression to
`const` or `let`.

Preferred:

```ts
function calculateTotal(prices: number[]) {
  return prices.reduce((total, price) => total + price, 0)
}

export async function fetchResponse(url: string) {
  return fetch(url)
}
```

Avoid:

```ts
const calculateTotal = (prices: number[]) => {
  return prices.reduce((total, price) => total + price, 0)
}

export const fetchResponse = async (url: string) => fetch(url)
```

Use the same declaration style for components and hooks: `function UserCard()`
and `function useUsers()`, with typed parameters as needed.

## Use arrows for inline callbacks

Arrow functions are allowed when supplied inline as callbacks, including:

- Arguments to array methods, promises, event listeners, and other functions.
- React JSX event handlers and other callback props.
- Callback properties in configuration objects, such as `queryFn` and `onSuccess`.
- React hook callbacks and cleanup callbacks returned from effects.

```tsx
const activeUsers = users.filter((user) => user.isActive)

const usersQuery = useQuery({
  queryKey: ['users'],
  queryFn: ({ signal }) => fetchUsers(signal),
})

const refreshButton = <button onClick={() => refreshUsers()}>Refresh</button>

useEffect(() => {
  const subscription = subscribeToUpdates()
  return () => subscription.unsubscribe()
}, [])
```

If a callback needs its own name, declare it with `function` and pass the
reference. Keep inline callbacks focused; extract a named function when doing
so makes the code easier to follow.

## Keep callback wrappers intact

A function returned by a hook or another wrapper may be assigned to a constant.
The arrow passed into the wrapper is still an inline callback:

```tsx
const handleSave = useCallback(() => {
  saveChanges(draft)
}, [draft])
```

Keep wrappers when required for behavior or function identity. Do not introduce
a wrapper merely to avoid using a function declaration.

## Methods, types, and formatting

Object and class method syntax remains valid. An arrow in a TypeScript function
type describes a type, not a function implementation, and remains valid too:

```ts
type OnSelect = (id: string) => void

const selection = {
  select(id: string) {
    return id
  },
}
```

Examples here omit semicolons to match the frontend, mobile, and website
packages. Backend code must continue using semicolons and explicit `.ts`
extensions in relative imports. This guide does not change compiler or lint
configuration.
