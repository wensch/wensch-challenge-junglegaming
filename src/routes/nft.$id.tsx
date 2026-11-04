import { createFileRoute, notFound } from '@tanstack/react-router'
import { idSchema, nftDetailSearchSchema } from '@/api/contracts'
import { NftDetailPage } from '@/features/nft/NftDetailPage'
import { nftQueries } from '@/queries/nfts'

export const Route = createFileRoute('/nft/$id')({
  validateSearch: nftDetailSearchSchema,
  // A malformed id can never exist: answer 404 without a request.
  beforeLoad: ({ params }) => {
    if (!idSchema.safeParse(params.id).success) throw notFound()
  },
  // Warms the cache on preload/navigation; the page renders its own skeleton, so nothing blocks.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQueries.detail(params.id))
  },
  head: () => ({ meta: [{ title: 'Detalhes do NFT — KURIO' }] }),
  component: NftDetailPage,
})
