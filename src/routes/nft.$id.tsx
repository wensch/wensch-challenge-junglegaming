import { createFileRoute, notFound } from '@tanstack/react-router'
import { idSchema, nftDetailSearchSchema } from '@/api/contracts'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/nft/$id')({
  validateSearch: nftDetailSearchSchema,
  // A malformed id can never exist: answer 404 without a request.
  beforeLoad: ({ params }) => {
    if (!idSchema.safeParse(params.id).success) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Detalhes do NFT — KURIO' }] }),
  component: NftDetailPage,
})

function NftDetailPage() {
  return <UnderConstruction title="Detalhes do NFT" slice="S1 — Catálogo" />
}
