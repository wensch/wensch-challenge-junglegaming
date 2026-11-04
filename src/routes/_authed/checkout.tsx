import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'

export const Route = createFileRoute('/_authed/checkout')({
  head: () => ({ meta: [{ title: 'Pagamento — KURIO' }] }),
  component: CheckoutPage,
})
