/**
 * Shared completion of login and register: establishes the session (teardown of a previous user,
 * guest-cart merge — `useEstablishSession`), announces merge adjustments and returns the visitor to the
 * flow they came from. `redirect` was already validated by `authSearchSchema` (safeRedirectSchema).
 */
import { useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Session } from '@/api/contracts'
import { useEstablishSession } from '@/session/hooks'

export function useFinishAuth(redirect: string | undefined) {
  const { establish, isPending } = useEstablishSession()
  const router = useRouter()
  const finish = useCallback(
    async (session: Session) => {
      const result = await establish(session)
      if (result.mergeError) toast.warning('Entramos, mas não foi possível juntar o carrinho de visitante agora. Ele será tentado de novo no próximo login.')
      else if (result.adjusted.length > 0) {
        const n = result.adjusted.length
        toast.info(`${n} ${n === 1 ? 'item do carrinho foi ajustado' : 'itens do carrinho foram ajustados'} pela disponibilidade.`)
      }
      await router.navigate({ to: redirect ?? '/' })
    },
    [establish, router, redirect],
  )
  return { finish, isPending }
}
