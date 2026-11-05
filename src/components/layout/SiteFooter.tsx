/**
 * Footer (Figma instance "Footer", 1200x610, identical in every desktop frame):
 * 1) highlights + newsletter band, 2) brand band, 3) link columns + social + wallets, 4) copyright.
 * Out-of-scope destinations go to `/em-breve` (honest "indisponível"); the newsletter is disabled
 * and labelled "em breve" instead of simulating a subscription (ARCHITECTURE §12, §13).
 * Mobile has no footer frame: the same content is stacked (derived layout).
 */
import { Link } from '@tanstack/react-router'
import type { Category } from '@/api/contracts'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/icons/figma'
import type { UnavailableSection } from './sections'

const highlights = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
] as const

const unavailable = (label: string, secao: UnavailableSection) => ({ kind: 'unavailable' as const, label, secao })

const profileLinks = [
  { kind: 'route' as const, label: 'Meu perfil', to: '/profile' as const },
  unavailable('Minha coleção', 'colecao'),
  unavailable('Atividade', 'atividade'),
  unavailable('Estúdio do criador', 'estudio'),
  { kind: 'route' as const, label: 'Lista de interesse', to: '/favorites' as const },
]

const helpLinks = [
  unavailable('Central de ajuda', 'ajuda'),
  unavailable('Como comprar NFTs', 'como-comprar'),
  unavailable('Carteira e segurança', 'seguranca'),
  unavailable('Política do mercado', 'politica'),
  unavailable('Denunciar item', 'denunciar'),
]

const collectionLinks: { label: string; category: Category }[] = [
  { label: 'Arte digital', category: 'arte-digital' },
  { label: 'Fotografia', category: 'fotografia' },
  { label: 'Música', category: 'musica' },
  { label: 'Arte 3D', category: 'arte-3d' },
  { label: 'Utilidade', category: 'utilidade' },
]

const socials = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
] as const

const linkClass = 'text-body-sm text-foreground hover:text-text-accent'
const headingClass = 'text-body-lg font-bold text-text-primary'

type FooterLink = (typeof profileLinks)[number]

function FooterItem({ link }: { link: FooterLink }) {
  if (link.kind === 'route') {
    return (
      <Link to={link.to} className={linkClass}>
        {link.label}
      </Link>
    )
  }
  return (
    <Link to="/em-breve" search={{ secao: link.secao }} className={linkClass}>
      {link.label}
      <span className="sr-only"> (em breve)</span>
    </Link>
  )
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-page px-gutter pb-[calc(var(--spacing-tabbar)+1.5rem)] md:mt-24 md:pb-6 xl:px-0">
      <div className="bg-card">
        {/* 1. Highlights + newsletter */}
        {/* Figma 1440: padding 32/48/18/30, dividers at x = 297/563/829 of the column (249/266/266 px columns). */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 px-6 py-8 md:grid-cols-2 md:px-12 lg:grid-cols-[1fr_1fr_1fr_1.25fr] lg:gap-0 xl:grid-cols-[249px_266px_266px_1fr] xl:pt-8 xl:pr-[30px] xl:pb-[18px]">
          {highlights.map((h, i) => (
            <section
              key={h.letter}
              aria-labelledby={`footer-hl-${i}`}
              className={`grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 md:block ${i === 0 ? 'lg:pr-4' : 'lg:border-l lg:border-primary/50 lg:px-4 xl:pl-[17px]'}`}
            >
              <span aria-hidden="true" className="row-span-2 grid size-12 place-items-center rounded-full bg-primary text-body-lg font-bold text-primary-foreground md:size-[74px] md:text-heading">
                {h.letter}
              </span>
              <h2 id={`footer-hl-${i}`} className="text-[17px] leading-6 font-bold text-text-primary md:mt-2.5">
                {h.title}
              </h2>
              <p className="mt-1 text-body-sm text-text-secondary md:mt-1.5 xl:max-w-[210px]">{h.text}</p>
            </section>
          ))}
          <section aria-labelledby="footer-newsletter" className="lg:border-l lg:border-primary lg:pl-4 xl:pl-4">
            <h2 id="footer-newsletter" className="text-[17px] leading-4 font-bold text-text-primary">
              Antecipe-se ao próximo lançamento
            </h2>
            <form className="mt-4 flex" onSubmit={(e) => e.preventDefault()} aria-describedby="footer-newsletter-status">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                E-mail para a newsletter
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                disabled
                placeholder="digite seu e-mail..."
                className="h-10 min-w-0 flex-1 rounded-l-control bg-secondary px-3 text-body text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled
                className="h-10 rounded-r-control bg-primary px-4 text-body-lg font-bold text-primary-foreground disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </form>
            <p className="mt-4 text-caption text-text-secondary">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
            <p id="footer-newsletter-status" className="mt-1 text-caption font-bold text-text-accent">
              Newsletter em breve.<span className="sr-only"> Inscrições ainda não estão abertas.</span>
            </p>
          </section>
        </div>

        {/* 2. Brand band */}
        {/* Figma 1440: 88 px band, texts at x = 32/335/638/940 of the column. */}
        <div className="grid gap-3 bg-surface-dark px-6 py-6 text-body-sm text-foreground md:grid-cols-2 md:items-center md:px-8 lg:grid-cols-4 xl:grid-cols-[303px_303px_302px_1fr] xl:gap-0 xl:py-[22px]">
          <p className="font-bold tracking-figma text-text-primary">KURIO</p>
          <p className="xl:max-w-[240px]">Feito para colecionadores, criadores e cultura</p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </div>

        {/* 3. Link columns */}
        {/* Figma 1440: same columns as the brand band; heading 28 px from the top, 30 px rows, 34 px bottom. */}
        <div className="grid grid-cols-2 gap-8 px-6 pt-10 pb-12 md:px-8 lg:grid-cols-4 xl:grid-cols-[303px_303px_302px_1fr] xl:gap-x-0 xl:pt-7 xl:pb-[34px]">
          <nav aria-labelledby="footer-profile">
            <h2 id="footer-profile" className={headingClass}>
              Meu perfil
            </h2>
            <ul className="mt-2 flex flex-col gap-2 text-body-sm">
              {profileLinks.map((l) => (
                <li key={l.label}>
                  <FooterItem link={l} />
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className={headingClass}>
              Central de ajuda
            </h2>
            <ul className="mt-2 flex flex-col gap-2 text-body-sm">
              {helpLinks.map((l) => (
                <li key={l.label}>
                  <FooterItem link={l} />
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="footer-collections">
            <h2 id="footer-collections" className={headingClass}>
              Coleções
            </h2>
            <ul className="mt-2 flex flex-col gap-2 text-body-sm">
              {collectionLinks.map((c) => (
                <li key={c.category}>
                  <Link to="/" search={{ categories: [c.category] }} className={linkClass}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className={headingClass}>Redes sociais</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {socials.map(({ label, Icon }) => (
                <li key={label}>
                  <Link
                    to="/em-breve"
                    search={{ secao: 'redes-sociais' }}
                    aria-label={`${label} (em breve)`}
                    className="grid size-8 place-items-center rounded-control text-primary hover:bg-secondary"
                  >
                    <Icon />
                  </Link>
                </li>
              ))}
            </ul>
            <h2 className={`${headingClass} mt-6`}>Carteiras compatíveis</h2>
            <p className="mt-2 inline-block rounded-control border border-line-soft bg-surface-dark px-2.5 py-1.5 text-tiny font-bold tracking-wide text-primary xl:text-micro xl:whitespace-nowrap">
              METAMASK · WALLETCONNECT · COINBASE
            </p>
          </div>
        </div>
      </div>

      {/* 4. Copyright */}
      <p className="py-3 text-center text-body-sm text-foreground xl:py-[7px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
