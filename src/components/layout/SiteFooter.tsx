/**
 * Footer (Figma instance "Footer", 1200x610, identical in every desktop frame):
 * 1) highlights + newsletter band, 2) brand band, 3) link columns + social + wallets, 4) copyright.
 * Out-of-scope destinations go to `/em-breve` (honest "indisponível"); the newsletter is disabled
 * and labelled "em breve" instead of simulating a subscription (ARCHITECTURE §12, §13).
 * Mobile has no footer frame: the same content is stacked (derived layout).
 */
import { Link } from '@tanstack/react-router'
import type { Category } from '@/api/contracts'
import { FacebookGlyph, InstagramGlyph, LinkedinGlyph, TwitterGlyph, YoutubeGlyph } from './brand-icons'
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
  { label: 'Facebook', Icon: FacebookGlyph },
  { label: 'Instagram', Icon: InstagramGlyph },
  { label: 'Twitter', Icon: TwitterGlyph },
  { label: 'LinkedIn', Icon: LinkedinGlyph },
  { label: 'YouTube', Icon: YoutubeGlyph },
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
        <div className="grid gap-8 px-6 py-8 md:grid-cols-2 md:px-12 lg:grid-cols-[1fr_1fr_1fr_1.25fr] lg:gap-0">
          {highlights.map((h, i) => (
            <section
              key={h.letter}
              aria-labelledby={`footer-hl-${i}`}
              className={i === 0 ? 'lg:pr-4' : 'lg:border-l lg:border-primary/50 lg:px-4'}
            >
              <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-primary text-heading font-bold text-primary-foreground">
                {h.letter}
              </span>
              <h2 id={`footer-hl-${i}`} className="mt-3 text-[17px] leading-6 font-bold text-text-primary">
                {h.title}
              </h2>
              <p className="mt-2 text-body-sm text-text-secondary">{h.text}</p>
            </section>
          ))}
          <section aria-labelledby="footer-newsletter" className="lg:border-l lg:border-primary lg:pl-4">
            <h2 id="footer-newsletter" className="text-[17px] leading-4 font-bold text-text-primary">
              Antecipe-se ao próximo lançamento
            </h2>
            <form className="mt-5 flex" onSubmit={(e) => e.preventDefault()} aria-describedby="footer-newsletter-status">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                E-mail para a newsletter
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                disabled
                placeholder="digite seu e-mail..."
                className="h-10 min-w-0 flex-1 rounded-l-[var(--radius-control)] bg-secondary px-3 text-body text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled
                className="h-10 rounded-r-[var(--radius-control)] bg-primary px-4 text-body-lg font-bold text-primary-foreground disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </form>
            <p className="mt-4 text-caption text-text-secondary">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
            <p id="footer-newsletter-status" className="mt-1 text-caption font-bold text-text-accent">
              Newsletter em breve: inscrições ainda não estão abertas.
            </p>
          </section>
        </div>

        {/* 2. Brand band */}
        <div className="grid gap-3 bg-surface-dark px-6 py-6 text-body-sm text-foreground md:grid-cols-4 md:items-center md:px-8">
          <p className="font-bold tracking-figma text-text-primary">KURIO</p>
          <p>Feito para colecionadores, criadores e cultura</p>
          <p>contato@email.com</p>
          <p>+55 11 4002 8922</p>
        </div>

        {/* 3. Link columns */}
        <div className="grid grid-cols-2 gap-8 px-6 pt-10 pb-12 md:grid-cols-4 md:px-8">
          <nav aria-labelledby="footer-profile">
            <h2 id="footer-profile" className={headingClass}>
              Meu perfil
            </h2>
            <ul className="mt-2 flex flex-col gap-2.5">
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
            <ul className="mt-2 flex flex-col gap-2.5">
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
            <ul className="mt-2 flex flex-col gap-2.5">
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
                    className="grid size-8 place-items-center rounded-[var(--radius-control)] border border-primary text-primary hover:bg-secondary"
                  >
                    <Icon />
                  </Link>
                </li>
              ))}
            </ul>
            <h2 className={`${headingClass} mt-6`}>Carteiras compatíveis</h2>
            <p className="mt-2 inline-block rounded-[var(--radius-control)] border border-line-soft bg-surface-dark px-2.5 py-1.5 text-tiny font-bold tracking-wide text-primary">
              METAMASK · WALLETCONNECT · COINBASE
            </p>
          </div>
        </div>
      </div>

      {/* 4. Copyright */}
      <p className="py-3 text-center text-body-sm text-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
