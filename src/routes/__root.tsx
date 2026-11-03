import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { NotFoundPage, RouteErrorPage } from '@/components/layout/PageStates'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Toaster } from '@/components/ui/sonner'
import { sessionQueryOptions } from '@/queries/session'
import { RealtimeBridge } from '@/realtime/RealtimeBridge'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // Boot: resolve the session once (GET /session only if a token exists). A transport failure
  // here must not take the whole app down: the visitor shell renders and private routes retry.
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(sessionQueryOptions()).catch(() => null)
  },
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => <RouteErrorPage error={error} />,
})

function RootLayout() {
  return (
    <>
      <HeadContent />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <MobileTabBar />
      <Toaster position="top-center" />
      <RealtimeBridge />
    </>
  )
}
