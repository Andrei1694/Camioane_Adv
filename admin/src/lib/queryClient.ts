import { focusManager, QueryClient } from '@tanstack/react-query'

focusManager.setEventListener((handleFocus) => {
  const onFocus = () => handleFocus()
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onFocus)
  return () => {
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onFocus)
  }
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, networkMode: 'always', refetchOnReconnect: true },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  },
})
