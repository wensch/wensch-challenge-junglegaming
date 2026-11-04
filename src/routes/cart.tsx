import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/CartPage'

// Public: visitors have a server-side guest cart (X-Guest-Id); checkout itself is private.
export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho de NFTs — KURIO' }] }),
  component: CartPage,
})
