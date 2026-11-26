import { focusManager, QueryClient } from '@tanstack/react-query'

focusManager.setEventListener((handleFocus) => {
  function onFocus() {
    if (document.visibilityState === 'visible') handleFocus()
    else handleFocus(false)
  }
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
