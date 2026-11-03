import { createFileRoute, Link } from '@tanstack/react-router'
import { UNAVAILABLE_SECTIONS, unavailableSearchSchema } from '@/components/layout/sections'

// Destination of every Figma link that is outside the challenge scope (ARCHITECTURE §12).
export const Route = createFileRoute('/em-breve')({
  validateSearch: unavailableSearchSchema,
  head: () => ({ meta: [{ title: 'Em breve — KURIO' }] }),
  component: UnavailablePage,
})

function UnavailablePage() {
  const { secao } = Route.useSearch()
  const name = secao ? UNAVAILABLE_SECTIONS[secao] : 'Esta área'
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-start gap-4 px-gutter py-16 md:py-24 xl:px-0">
      <p className="text-body-sm tracking-figma text-text-secondary">Em breve</p>
      <h1 className="text-heading font-bold text-text-primary md:text-display md:leading-[1.3]">{name}</h1>
      <p className="text-body text-text-secondary">
        {name} ainda não está disponível nesta versão do marketplace. Nenhuma ação foi realizada.
      </p>
      <Link to="/" className="text-body-md font-medium text-text-accent underline-offset-4 hover:underline">
        Voltar para o início
      </Link>
    </section>
  )
}
