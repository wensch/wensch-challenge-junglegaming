import { createFileRoute, Link } from '@tanstack/react-router'
import { PageFrame } from '@/components/layout/PageStates'
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
    <PageFrame title={name} eyebrow="Em breve">
      <p className="text-body text-text-secondary">
        {name} ainda não está disponível nesta versão do marketplace. Nenhuma ação foi realizada.
      </p>
      <Link to="/" className="text-body-md font-medium text-text-accent underline-offset-4 hover:underline">
        Voltar para o início
      </Link>
    </PageFrame>
  )
}
