/**
 * Maps API errors onto react-hook-form (CON-6): `fieldErrors` of VALIDATION / EMAIL_TAKEN go to the
 * matching field (server keys can be renamed with `fieldMap`); anything else becomes the form-level
 * (`root.server`) message.
 */
import type { FieldErrors, FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/contracts'
import { errorMessageOf } from '@/components/layout/PageStates'

export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  fieldMap: Record<string, string> = {},
): void {
  if (isApiError(error) && error.fieldErrors) {
    let placed = false
    const extra: string[] = []
    for (const [key, messages] of Object.entries(error.fieldErrors)) {
      const target = fieldMap[key] ?? key
      const message = messages.join(' ')
      if (fields.includes(target)) {
        setError(target as Path<T>, { type: 'server', message })
        placed = true
      } else extra.push(message)
    }
    if (extra.length > 0 || !placed) setError('root.server', { type: 'server', message: extra.join(' ') || errorMessageOf(error) })
    return
  }
  setError('root.server', { type: 'server', message: errorMessageOf(error) })
}

/** Message of the form-level (non-field) server error, if any. */
export function rootMessage(errors: FieldErrors<FieldValues>): string | undefined {
  const root = errors.root as { server?: { message?: string } } | undefined
  return root?.server?.message
}
