import { createFileRoute } from '@tanstack/react-router'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/_authed/checkout')({
  head: () => ({ meta: [{ title: 'Pagamento — KURIO' }] }),
  component: CheckoutPage,
})

function CheckoutPage() {
  return <UnderConstruction title="Pagamento" slice="S3 — Checkout" />
}
