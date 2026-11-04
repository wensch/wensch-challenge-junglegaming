/** Maps API validation errors (`fieldErrors`, keyed by the body path) onto react-hook-form fields. */
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/contracts'

/**
 * Applies `ApiError.fieldErrors` to the form. `alias` renames API paths to form fields
 * (`collector.email` -> `email`). Returns the paths that did NOT match any field, so the caller can show
 * them as a form-level message instead of losing them.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  alias: Record<string, Path<T>> = {},
): string[] {
  if (!isApiError(error) || !error.fieldErrors) return []
  const unmatched: string[] = []
  for (const [path, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0]
    if (!message) continue
    const name = alias[path] ?? (path.startsWith('collector.') ? path.slice('collector.'.length) : path)
    const field = fields.find((f) => f === name)
    if (field) setError(field, { type: 'server', message })
    else unmatched.push(message)
  }
  return unmatched
}
