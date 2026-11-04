import { createFileRoute, notFound } from '@tanstack/react-router'
import { idSchema } from '@/api/contracts'
import { OrderPage } from '@/features/order/OrderPage'

export const Route = createFileRoute('/_authed/orders/$id')({
  beforeLoad: ({ params }) => {
    if (!idSchema.safeParse(params.id).success) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Pedido — KURIO' }] }),
  component: OrderRoute,
})

function OrderRoute() {
  const { id } = Route.useParams()
  return <OrderPage orderId={id} />
}
