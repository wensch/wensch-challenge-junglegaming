/**
 * Form field shell shared by the account screens: label (visible or screen-reader only), control and
 * error message wired with `aria-describedby` / `aria-invalid` (WCAG 3.3.1, 1.3.1). The control receives
 * its a11y props through the render function, so it works with <input>, Radix Select triggers, etc.
 */
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
  'aria-required': true | undefined
}

export function Field({
  label,
  error,
  hint,
  required,
  srOnlyLabel,
  className,
  children,
}: {
  label: string
  error?: string | undefined
  hint?: string | undefined
  required?: boolean
  srOnlyLabel?: boolean
  className?: string
  children: (props: ControlProps) => ReactNode
}) {
  const uid = useId()
  const id = `f${uid.replace(/:/g, '')}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-body-sm leading-4 text-text-primary', srOnlyLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-caption-sm text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-caption-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Visual style of a text control of the account screens (Figma: 40 px, 1 px line, 4 px radius). */
export const controlClass =
  'h-10 w-full rounded-control border border-line-soft bg-transparent px-3 text-body-sm text-text-primary placeholder:text-text-secondary/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-0 disabled:opacity-60 md:text-body-sm'
