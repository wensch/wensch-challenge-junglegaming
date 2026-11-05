/**
 * Header search (desktop): the magnifier opens a small panel under the header (no layout shift).
 * Submitting goes to `/` with `q` (keeping the filters when already on the catalog) and resets the page.
 * `#busca` in the URL opens it too (the mobile menu link and the header link used to point there).
 */
import { useRef, useState } from 'react'
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import { SearchIcon } from '@/components/icons/figma'
import { SearchForm } from './SearchForm'

export function HeaderSearch() {
  const navigate = useNavigate()
  const isHome = useRouterState({ select: (s) => s.location.pathname === '/' })
  const hash = useRouterState({ select: (s) => s.location.hash })
  const search = useSearch({ strict: false })
  const q = typeof search.q === 'string' ? search.q : ''
  const [open, setOpen] = useState(hash === 'busca')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Opening by `#busca` is derived while rendering (a new hash value), not synchronized in an effect.
  const [seenHash, setSeenHash] = useState(hash)
  if (hash !== seenHash) {
    setSeenHash(hash)
    if (hash === 'busca') setOpen(true)
  }

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const onSearch = (term: string | undefined) => {
    close(true)
    if (isHome) void navigate({ to: '/', hash: 'mercado', search: (prev) => ({ ...prev, q: term, page: 1 }) })
    else void navigate({ to: '/', hash: 'mercado', search: { q: term } })
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) close(true)
      }}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Buscar NFTs"
        aria-expanded={open}
        aria-controls="header-search-panel"
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-control text-text-primary hover:text-text-accent"
      >
        <SearchIcon />
      </button>
      {open && (
        <div id="header-search-panel" className="absolute top-full right-0 z-30 mt-3 w-[min(360px,calc(100vw-48px))] rounded-control border border-line-soft bg-popover p-3 shadow-lg">
          <SearchForm formLabel="Busca no cabeçalho" value={q} onSearch={onSearch} placeholder="Buscar por nome, coleção ou token" autoFocus submitLabel="Buscar" />
        </div>
      )}
    </div>
  )
}
