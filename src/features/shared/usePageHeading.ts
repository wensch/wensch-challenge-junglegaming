/** After a CLIENT-SIDE navigation the page `h1` takes focus (same rule as `PageFrame`, shell volta 2). */
import { useEffect, useRef } from 'react'
import { hasClientNavigated } from '@/lib/navigation'

export function usePageHeadingFocus<T extends HTMLElement = HTMLHeadingElement>(dep?: unknown) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (hasClientNavigated()) ref.current?.focus({ preventScroll: true })
  }, [dep])
  return ref
}
