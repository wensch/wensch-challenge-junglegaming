import { createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { NotFoundPage, RouteErrorPage } from '@/components/layout/PageStates'
import { routeTree } from './routeTree.gen'

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    // Data freshness is owned by TanStack Query; the router never caches loader data itself.
    defaultPreloadStaleTime: 0,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: ({ error }) => <RouteErrorPage error={error} />,
  })
}

export type AppRouterInstance = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouterInstance
  }
}
