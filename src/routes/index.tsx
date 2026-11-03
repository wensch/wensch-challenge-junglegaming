import { createFileRoute } from '@tanstack/react-router'
import { catalogSearchSchema } from '@/api/contracts'
import { UnderConstruction } from '@/components/layout/PageStates'

// Search params are validated here so every filter/sort/page lives in the URL (CAT-*).
export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  head: () => ({ meta: [{ title: 'KURIO — Mercado de NFTs' }] }),
  component: HomePage,
})

function HomePage() {
  return <UnderConstruction title="Mercado de NFTs" slice="S1 — Catálogo" />
}
