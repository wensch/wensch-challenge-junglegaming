/**
 * Two promo cards under the grid (Figma "Promos", 586x250 each). Desktop only (the mobile frame has
 * none). Their buttons are real shortcuts into the catalog (new releases / digital art), not dead links.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PROMOS = [
  {
    image: '/nft/artwork-03.png',
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    search: { tab: 'new' as const },
    label: 'Explorar lançamentos gênesis',
  },
  {
    image: '/nft/artwork-05.png',
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    search: { categories: ['arte-digital' as const] },
    label: 'Explorar arte digital selecionada',
  },
] as const

export function Promos() {
  return (
    <section aria-label="Promoções" className="mt-24 hidden gap-7 md:grid md:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.title} className="relative flex h-[250px] overflow-hidden rounded-control bg-surface-card">
          <img src={promo.image} alt="" width={292} height={250} loading="lazy" decoding="async" className="h-full w-[292px] shrink-0 rounded-control object-cover object-top" />
          <div className="flex min-w-0 flex-1 flex-col items-end gap-3 px-6 py-9 text-right">
            <h2 className="text-body-md font-bold text-text-primary">{promo.title}</h2>
            <p className="text-caption-sm leading-[15px] text-text-secondary">{promo.text}</p>
            <Button asChild className="mt-auto h-10 w-[140px] gap-2 rounded-control text-body-md font-medium">
              <Link to="/" search={promo.search} hash="mercado" aria-label={promo.label}>
                Explorar <ArrowRight aria-hidden="true" className="size-[18px]" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}
