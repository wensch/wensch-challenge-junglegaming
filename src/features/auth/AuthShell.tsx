/**
 * Frame of /login and /register. Desktop (Figma 9:115 / 9:1022): 500 px panel with a 10 px brand bottom
 * border, tabs "Entrar | Criar conta", 340 px fields. Mobile (16:1022 / 16:1228): full page with the
 * large KURIO mark and the title. Same markup for both; breakpoints switch the presentation.
 * Social sign-in is out of scope (ARCHITECTURE §12): the buttons are disabled and say so.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import type { AuthSearch } from '@/api/contracts'
import { FacebookGlyph } from '@/components/layout/brand-icons'
import { Button } from '@/components/ui/button'
import { hasClientNavigated } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useSession } from '@/queries/session'

const REASON_TEXT: Record<NonNullable<AuthSearch['reason']>, string> = {
  expired: 'Sua sessão expirou. Entre novamente para continuar de onde parou.',
  required: 'Entre na sua conta para continuar.',
}

export function AuthShell({
  mode,
  search,
  description,
  children,
}: {
  mode: 'login' | 'register'
  search: AuthSearch
  description: string
  children: ReactNode
}) {
  const session = useSession()
  const title = mode === 'login' ? 'Entrar' : 'Criar conta'
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (hasClientNavigated()) headingRef.current?.focus({ preventScroll: true })
  }, [mode])
  // Tabs keep the flow context (redirect) when moving between login and register.
  const carry = { ...(search.redirect ? { redirect: search.redirect } : {}), ...(search.reason ? { reason: search.reason } : {}) }
  const tab = 'text-body-lg font-bold transition-colors hover:text-text-accent'

  return (
    <div className="mx-auto flex w-full max-w-page justify-center px-gutter pt-10 pb-16 md:pt-16 md:pb-24 xl:px-0">
      <section
        aria-labelledby="auth-title"
        className="relative flex w-full max-w-[500px] flex-col items-stretch md:border-b-[10px] md:border-primary md:bg-surface-card md:px-[80px] md:pt-[44px] md:pb-12"
      >
        <Link
          to="/"
          aria-label="Fechar"
          className="absolute top-3 right-3 hidden rounded-control p-1 text-text-accent hover:text-text-primary md:inline-flex"
        >
          <X aria-hidden="true" className="size-5" />
        </Link>

        {/* Mobile: brand mark + title. */}
        <p aria-hidden="true" className="mb-12 text-center text-heading font-bold tracking-figma text-text-primary md:hidden">
          KURIO
        </p>
        <h1
          id="auth-title"
          ref={headingRef}
          tabIndex={-1}
          className="mb-6 text-center text-body-lg font-bold text-text-primary outline-none max-md:mb-8 md:sr-only"
        >
          {title}
        </h1>
        {/* Desktop: tabs. */}
        <nav aria-label="Entrar ou criar conta" className="mb-6 hidden items-center justify-center gap-3 md:flex">
          <Link to="/login" search={carry} className={cn(tab, mode === 'login' ? 'text-text-accent' : 'text-text-primary')} aria-current={mode === 'login' ? 'page' : undefined}>
            Entrar
          </Link>
          <span aria-hidden="true" className="h-5 w-px bg-primary" />
          <Link
            to="/register"
            search={carry}
            className={cn(tab, mode === 'register' ? 'text-text-accent' : 'text-text-primary')}
            aria-current={mode === 'register' ? 'page' : undefined}
          >
            Criar conta
          </Link>
        </nav>

        <p className="mb-6 hidden text-center text-caption-sm text-text-primary md:block">{description}</p>

        {search.reason && (
          <p role="status" className="mb-4 rounded-control border border-line-soft bg-surface-dark px-3 py-2 text-caption-sm text-text-primary">
            {REASON_TEXT[search.reason]}
          </p>
        )}
        {session.data && (
          <p role="status" className="mb-4 rounded-control border border-line-soft px-3 py-2 text-caption-sm text-text-secondary">
            Você está conectado como {session.data.user.displayName}. Entrar com outra conta troca o usuário desta sessão.
          </p>
        )}

        {children}

        <div className="mt-8 flex items-center gap-3 text-caption-sm text-text-primary">
          <span aria-hidden="true" className="h-px flex-1 bg-line-soft" />
          Ou continue com
          <span aria-hidden="true" className="h-px flex-1 bg-line-soft" />
        </div>
        <div className="mt-4 flex flex-col gap-3" aria-describedby="social-note">
          <Button disabled variant="outline" className="h-10 rounded-control border-line text-caption-sm font-bold text-text-secondary">
            <span aria-hidden="true" className="text-body-md font-bold text-[#4285f4]">
              G
            </span>
            Continuar com Google
          </Button>
          <Button disabled variant="outline" className="h-10 rounded-control border-line text-caption-sm font-bold text-text-secondary">
            <FacebookGlyph className="text-[#3b5998]" />
            Continuar com Facebook
          </Button>
          <p id="social-note" className="text-center text-caption-sm text-text-secondary">
            Login social em breve.
          </p>
        </div>

        <p className="mt-10 text-center text-body-sm text-text-secondary md:hidden">
          {mode === 'login' ? (
            <>
              Novo na Kurio?{' '}
              <Link to="/register" search={carry} className="text-text-accent underline underline-offset-4">
                Crie uma conta
              </Link>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <Link to="/login" search={carry} className="text-text-accent underline underline-offset-4">
                Entre
              </Link>
            </>
          )}
        </p>
      </section>
    </div>
  )
}
