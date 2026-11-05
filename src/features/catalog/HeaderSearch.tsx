/**
 * Header search (md and up): the magnifier toggles a full-width search bar on its own row right below
 * the header. The bar is in the flow, so it pushes the content down instead of covering it (D41).
 * Submitting goes to `/` with `q` (keeping the filters when already on the catalog) and resets the page.
 * `#busca` in the URL opens it too (the mobile menu link and the header link used to point there).
 * Below `md` the header does not exist; the mobile home has its own inline search (MobileSearchBar).
 */
import { useRef, useState } from 'react'
import type { Ref } from 'react'
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import { SearchIcon } from '@/components/icons/figma'
import { X } from 'lucide-react'
import { SearchForm } from './SearchForm'

export function useHeaderSearch() {
  const hash = useRouterState({ select: (s) => s.location.hash })
  const [open, setOpen] = useState(hash === 'busca')
  const triggerRef = useRef<HTMLButtonElement>(null)

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
  return { open, toggle: () => setOpen((v) => !v), close, triggerRef }
}

export function HeaderSearchTrigger({ open, onToggle, triggerRef }: { open: boolean; onToggle: () => void; triggerRef: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label="Buscar NFTs"
      aria-expanded={open}
      aria-controls="header-search-bar"
      onClick={onToggle}
      className="grid size-9 place-items-center rounded-control text-text-primary hover:text-text-accent"
    >
      <SearchIcon />
    </button>
  )
}

export function HeaderSearchBar({ open, close }: { open: boolean; close: (restoreFocus: boolean) => void }) {
  const navigate = useNavigate()
  const isHome = useRouterState({ select: (s) => s.location.pathname === '/' })
  const search = useSearch({ strict: false })
  const q = typeof search.q === 'string' ? search.q : ''
  if (!open) return null

  const onSearch = (term: string | undefined) => {
    close(true)
    if (isHome) void navigate({ to: '/', hash: 'mercado', search: (prev) => ({ ...prev, q: term, page: 1 }) })
    else void navigate({ to: '/', hash: 'mercado', search: { q: term } })
  }

  return (
    <div
      id="header-search-bar"
      className="mx-auto w-full max-w-page px-gutter pt-3 xl:px-0"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close(true)
      }}
    >
      <SearchForm
        formLabel="Busca no cabeçalho"
        value={q}
        onSearch={onSearch}
        placeholder="Buscar por nome, coleção ou criador"
        autoFocus
        submitLabel="Buscar"
        className="rounded-card border border-line-soft bg-surface-card px-4 py-2"
        inputClassName="h-9"
        trailing={<CloseButton onClick={() => close(true)} />}
      />
    </div>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Fechar busca" onClick={onClick} className="grid size-8 shrink-0 place-items-center rounded-control text-text-secondary hover:text-text-primary">
      <X aria-hidden="true" className="size-5" />
    </button>
  )
}
