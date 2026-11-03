import { createFileRoute, notFound } from '@tanstack/react-router'
import { idSchema } from '@/api/contracts'
import { UnderConstruction } from '@/components/layout/PageStates'

export const Route = createFileRoute('/_authed/orders/$id')({
  beforeLoad: ({ params }) => {
    if (!idSchema.safeParse(params.id).success) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Pedido — KURIO' }] }),
  component: OrderPage,
})

function OrderPage() {
  return <UnderConstruction title="Pedido" slice="S3 — Checkout" />
}
