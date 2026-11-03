/**
 * Honest page states shared by routes: placeholder ("em construção"), 404 and route error.
 * Placeholders show only a title and a status line — no fake data or controls (TEL-11).
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

function PageFrame({ title, children, eyebrow }: { title: string; children: ReactNode; eyebrow?: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Move focus to the page title after client-side navigation (announces the new page).
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [title])
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-start gap-4 px-gutter py-16 md:py-24 xl:px-0">
      {eyebrow && <p className="text-body-sm tracking-figma text-text-secondary">{eyebrow}</p>}
      <h1 ref={headingRef} tabIndex={-1} className="text-heading font-bold text-text-primary outline-none md:text-display md:leading-[1.3]">
        {title}
      </h1>
      {children}
    </section>
  )
}

export function UnderConstruction({ title, slice }: { title: string; slice?: string }) {
  return (
    <PageFrame title={title} eyebrow="KURIO">
      <p role="status" className="rounded-control border border-line-soft bg-card px-4 py-3 text-body text-text-secondary">
        Em construção{slice ? ` — esta tela será entregue na etapa ${slice}` : ''}.
      </p>
      <Link to="/" className="text-body-md font-medium text-text-accent underline-offset-4 hover:underline">
        Voltar para o início
      </Link>
    </PageFrame>
  )
}

export function NotFoundPage() {
  return (
    <PageFrame title="Página não encontrada" eyebrow="Erro 404">
      <p className="text-body text-text-secondary">O endereço acessado não existe ou foi removido.</p>
      <Button asChild className="h-10 rounded-control px-5 text-body-md font-bold">
        <Link to="/">Explorar o mercado</Link>
      </Button>
    </PageFrame>
  )
}

export function RouteErrorPage({ error }: { error: unknown }) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : 'Erro inesperado.'
  return (
    <PageFrame title="Algo deu errado" eyebrow="Erro">
      <p role="alert" className="text-body text-text-secondary">
        {message}
      </p>
      <Button className="h-10 rounded-control px-5 text-body-md font-bold" onClick={() => void router.invalidate()}>
        Tentar novamente
      </Button>
    </PageFrame>
  )
}
