/** Moves focus to the page `h1` after a CLIENT-SIDE navigation only (same rule as `PageFrame`). */
import { useEffect, type RefObject } from 'react'
import { hasClientNavigated } from '@/lib/navigation'

export function useHeadingFocus(ref: RefObject<HTMLHeadingElement | null>, key: string | undefined) {
  useEffect(() => {
    if (key && hasClientNavigated()) ref.current?.focus({ preventScroll: true })
  }, [ref, key])
}
