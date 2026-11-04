import { AppState } from 'react-native'
import { focusManager, QueryClient } from '@tanstack/react-query'

// The app coming back to the foreground counts as focus, so stale queries such as the
// session check refetch and a revoked token signs the user out.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'))
  return () => subscription.remove()
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, networkMode: 'always', refetchOnReconnect: true },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  },
})
