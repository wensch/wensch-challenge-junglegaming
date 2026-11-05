/** Search field (react-hook-form + zod). Shared by the header panel (desktop) and the mobile search bar. */
import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search } from 'lucide-react'
import { z } from 'zod'
import { cn } from '@/lib/utils'

const searchFormSchema = z.object({ q: z.string().trim().max(100, 'Use até 100 caracteres.') })
type SearchFormValues = z.infer<typeof searchFormSchema>

interface SearchFormProps {
  /** Current term (from the URL); the field follows it (back/forward, "limpar filtros"). */
  value: string
  onSearch: (q: string | undefined) => void
  placeholder: string
  inputId?: string
  className?: string
  inputClassName?: string
  autoFocus?: boolean
  submitLabel?: string
  /** Accessible name of the search landmark (the header and the page each have one). */
  formLabel: string
  /** Extra control at the end of the row (e.g. a close button). */
  trailing?: ReactNode
}

export function SearchForm({ value, onSearch, placeholder, inputId, className, inputClassName, autoFocus, submitLabel, formLabel, trailing }: SearchFormProps) {
  const uid = useId()
  const id = inputId ?? `${uid}-q`
  const { register, handleSubmit, reset, formState } = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: { q: value },
  })
  useEffect(() => reset({ q: value }), [value, reset])
  const error = formState.errors.q?.message

  return (
    <form
      role="search"
      aria-label={formLabel}
      noValidate
      onSubmit={handleSubmit((values) => onSearch(values.q || undefined))}
      className={cn('flex flex-col gap-1', className)}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs
      </label>
      <div className="flex items-center gap-2">
        <Search aria-hidden="true" className="size-5 shrink-0 text-text-secondary" />
        <input
          id={id}
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('min-w-0 flex-1 bg-transparent text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none', inputClassName)}
          {...register('q')}
        />
        {submitLabel && (
          <button type="submit" className="h-8 shrink-0 rounded-control bg-primary px-3 text-body-sm font-bold text-primary-foreground">
            {submitLabel}
          </button>
        )}
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-caption-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
