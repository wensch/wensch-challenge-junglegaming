/**
 * Labelled form field of the checkout (Figma "Perfil do colecionador"): label with required marker, 40 px
 * control with the 1 px `line-soft` border, error text tied to the control by `aria-describedby` and
 * `aria-invalid`. Works with react-hook-form (`{...register('name')}`).
 */
import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const control =
  'h-10 w-full min-w-0 rounded-control border bg-transparent px-3 text-body-sm text-text-primary outline-none placeholder:text-text-secondary read-only:bg-surface-card/60 read-only:text-text-secondary focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60'

interface FieldShellProps {
  label: string
  required?: boolean | undefined
  error?: string | undefined
  hint?: string
  className?: string
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

function FieldShell({ label, required, error, hint, className, children }: FieldShellProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-sm text-text-primary">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-text-accent">
            *
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint ? (
        <p id={hintId} className="text-caption-sm text-text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({ label, required, error, hint, className, ...input }: Omit<ComponentProps<'input'>, 'children'> & { label: string; error?: string | undefined; hint?: string }) {
  return (
    <FieldShell label={label} required={required} error={error} {...(hint ? { hint } : {})} {...(className ? { className } : {})}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, invalid ? 'border-destructive' : 'border-line-soft')}
          {...input}
        />
      )}
    </FieldShell>
  )
}

export function TextAreaField({ label, error, hint, className, ...area }: Omit<ComponentProps<'textarea'>, 'children'> & { label: string; error?: string | undefined; hint?: string }) {
  return (
    <FieldShell label={label} error={error} {...(hint ? { hint } : {})} {...(className ? { className } : {})}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(control, 'h-[152px] resize-none py-2', invalid ? 'border-destructive' : 'border-line-soft')}
          {...area}
        />
      )}
    </FieldShell>
  )
}
