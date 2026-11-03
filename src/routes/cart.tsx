import { createFileRoute } from '@tanstack/react-router'
import { UnderConstruction } from '@/components/layout/PageStates'

// Public: visitors have a server-side guest cart (X-Guest-Id); checkout itself is private.
export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho de NFTs — KURIO' }] }),
  component: CartPage,
})

function CartPage() {
  return <UnderConstruction title="Carrinho de NFTs" slice="S3 — Checkout" />
}
