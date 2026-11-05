/**
 * Shared pieces of the editorial pages (`/criadores`, `/aprenda`): hero block with the page `h1`
 * (takes focus after a client-side navigation, same rule as `PageFrame`) and the honest
 * empty/error message box (same look as the catalog's).
 */
import type { ReactNode } from 'react'
import { usePageHeadingFocus } from '@/features/shared/usePageHeading'
import { cn } from '@/lib/utils'

export function EditorialHero({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const headingRef = usePageHeadingFocus(title)
  return (
    <header className="flex flex-col gap-3 rounded-card bg-gradient-to-br from-surface-dark to-surface-card px-6 py-8 md:rounded-none md:bg-none md:px-0 md:py-6">
      <p className="text-body-sm leading-4 tracking-figma text-text-secondary uppercase">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="text-heading font-bold text-text-primary outline-none wide:text-display">
        {title}
      </h1>
      <p className="max-w-[640px] text-caption leading-6 text-text-secondary md:text-body">{children}</p>
    </header>
  )
}

export function StateBox({ title, children, role, className }: { title: string; children: ReactNode; role?: 'alert' | 'status'; className?: string }) {
  return (
    <div role={role} className={cn('flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-card bg-surface-card px-6 py-12 text-center', className)}>
      <h2 className="text-heading font-bold text-text-primary">{title}</h2>
      {children}
    </div>
  )
}
