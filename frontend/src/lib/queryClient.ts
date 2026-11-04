import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, networkMode: 'always' },
    mutations: { retry: false, gcTime: 0, networkMode: 'always' },
  },
})
