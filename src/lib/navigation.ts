/**
 * Tracks whether a client-side navigation already happened in this document. Page titles take the
 * focus only after one (announces the new page to screen readers); on a full load the focus stays at
 * the document start so the first Tab reaches the skip link (WCAG 2.4.1 / 2.4.3).
 */
let navigated = false

export function markClientNavigation(): void {
  navigated = true
}

export function hasClientNavigated(): boolean {
  return navigated
}
