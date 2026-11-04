/**
 * Accessible announcement of real-time NFT changes (A11Y-6, RT-1). `realtime.onEvent` only delivers
 * events the reconciler APPLIED (validated, not duplicated, newer), so the message is never repeated
 * for a duplicate or stale event. The text is rendered by the page inside a `role="status"` region.
 */
import { useEffect, useRef, useState } from 'react'
import { realtime } from '@/realtime/socket'
import { formatEth } from '@/lib/money'

export function useNftUpdateMessage(resolveName: (nftId: string) => string | undefined): string {
  const [message, setMessage] = useState('')
  const resolve = useRef(resolveName)
  useEffect(() => {
    resolve.current = resolveName
  })
  useEffect(
    () =>
      realtime.onEvent((event) => {
        if (event.type !== 'nft.updated') return
        const name = resolve.current(event.data.nftId)
        if (!name) return
        setMessage(
          event.data.soldOut
            ? `${name} esgotou.`
            : `${name} foi atualizado: ${formatEth(event.data.price)}, ${event.data.available} ${event.data.available === 1 ? 'unidade disponível' : 'unidades disponíveis'}.`,
        )
      }),
    [],
  )
  return message
}
