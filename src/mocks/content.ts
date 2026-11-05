/**
 * Static editorial data (fictitious): creators directory and learning articles. Pure module, never
 * persisted: it does not touch the localStorage DB (`DB_VERSION` stays), so returning visitors need no reseed.
 */
import type {
  ArticleCategory,
  ArticleDetail,
  ArticleListQuery,
  ArticleListResponse,
  ArticleSummary,
  Creator,
  CreatorListQuery,
  CreatorListResponse,
} from '@/api/contracts'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// --- Creators ---------------------------------------------------------------

/** Inline SVG avatar (initials on a hue-tinted disc); `data:` is allowed by the CSP `img-src`. */
function avatarOf(name: string, hue: number): string {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 38%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 22%)"/></linearGradient></defs>` +
    `<rect width="96" height="96" fill="url(#g)"/>` +
    `<text x="48" y="58" text-anchor="middle" font-family="monospace" font-size="32" font-weight="700" fill="#f7f3ec">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

type CreatorSeed = Omit<Creator, 'avatar'> & { hue: number }

const CREATOR_SEEDS: CreatorSeed[] = [
  { id: 'cre_001', name: 'Luna Prado', handle: 'lunaprado', bio: 'Ilustra paisagens oníricas em luz neon e cunha séries curtas a cada estação.', verified: true, followers: 18420, nftCount: 64, mainCollection: { id: 'col_aurora', name: 'Aurora Digital' }, hue: 28 },
  { id: 'cre_002', name: 'Caio Mendes', handle: 'caio.pixel', bio: 'Pixel art autoral inspirada em arcades e feiras de bairro.', verified: true, followers: 12980, nftCount: 112, mainCollection: { id: 'col_pixel', name: 'Pixel Atelier' }, hue: 340 },
  { id: 'cre_003', name: 'Marina Duarte', handle: 'marinaduarte', bio: 'Fotografa a luz de fim de tarde em cidades litorâneas.', verified: true, followers: 9640, nftCount: 41, mainCollection: { id: 'col_lume', name: 'Lume Fotografia' }, hue: 200 },
  { id: 'cre_004', name: 'Otávio Ramos', handle: 'otavio_ramos', bio: 'Compositor de trilhas ambientais, cada faixa é uma edição de 50.', verified: false, followers: 3210, nftCount: 27, mainCollection: { id: 'col_ondas', name: 'Ondas Sonoras' }, hue: 150 },
  { id: 'cre_005', name: 'Helena Vasques', handle: 'helena3d', bio: 'Esculturas 3D que parecem cerâmica e brincam com escala.', verified: true, followers: 15300, nftCount: 38, mainCollection: { id: 'col_volume', name: 'Volume 3D' }, hue: 262 },
  { id: 'cre_006', name: 'Rafael Quintana', handle: 'rafaquintana', bio: 'Colecionáveis raros com histórias de bastidor e procedência documentada.', verified: false, followers: 5870, nftCount: 73, mainCollection: { id: 'col_relic', name: 'Relíquias Raras' }, hue: 48 },
  { id: 'cre_007', name: 'Tarsila Nogueira', handle: 'tarsila.algo', bio: 'Arte generativa: algoritmos, ruído e muita paciência.', verified: true, followers: 21050, nftCount: 156, mainCollection: { id: 'col_algo', name: 'Algoritmo Vivo' }, hue: 180 },
  { id: 'cre_008', name: 'Bruno Salgado', handle: 'brunosalgado', bio: 'Personagens e itens para jogos independentes, prontos para usar.', verified: false, followers: 2480, nftCount: 89, mainCollection: { id: 'col_arena', name: 'Arena Pixelada' }, hue: 10 },
  { id: 'cre_009', name: 'Isadora Leite', handle: 'isadoraleite', bio: 'Passes de acesso e assinaturas para comunidades de artistas.', verified: true, followers: 7120, nftCount: 12, mainCollection: { id: 'col_passe', name: 'Passe Livre' }, hue: 95 },
  { id: 'cre_010', name: 'Davi Albuquerque', handle: 'davi.neon', bio: 'Retratos noturnos em néon, direto das ruas de São Paulo.', verified: true, followers: 11230, nftCount: 52, mainCollection: { id: 'col_neon', name: 'Neon Noturno' }, hue: 310 },
  { id: 'cre_011', name: 'Cecília Moraes', handle: 'ceciliamoraes', bio: 'Paisagens e texturas de terra batida registradas em viagens longas.', verified: false, followers: 1890, nftCount: 19, mainCollection: { id: 'col_terra', name: 'Terra Firme' }, hue: 70 },
  { id: 'cre_012', name: 'Yuri Castelo', handle: 'yuricastelo', bio: 'Chaves de acesso e utilidades para colecionadores avançados.', verified: false, followers: 940, nftCount: 8, mainCollection: { id: 'col_chave', name: 'Chave Mestra' }, hue: 220 },
]

const CREATORS: Creator[] = CREATOR_SEEDS.map(({ hue, ...c }) => ({ ...c, avatar: avatarOf(c.name, hue) }))

export function listCreators(q: CreatorListQuery, empty = false): CreatorListResponse {
  const terms = fold(q.q ?? '').split(/\s+/).filter(Boolean)
  const matching = empty
    ? []
    : CREATORS.filter((c) => {
        const hay = fold(`${c.name} ${c.handle} ${c.bio} ${c.mainCollection.name}`)
        return terms.every((t) => hay.includes(t))
      })
  const sorted = [...matching].sort((a, b) =>
    q.sort === 'followers' ? b.followers - a.followers || b.nftCount - a.nftCount : b.nftCount - a.nftCount || b.followers - a.followers,
  )
  const total = sorted.length
  return {
    items: sorted.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / q.pageSize) },
  }
}

// --- Articles ---------------------------------------------------------------

type ArticleSeed = Omit<ArticleSummary, 'image'> & {
  image: string
  author: string
  sections: [heading: string, paragraphs: string[]][]
}

const ARTICLE_SEEDS: ArticleSeed[] = [
  {
    slug: 'como-funciona-a-propriedade-de-nfts',
    title: 'Como funciona a propriedade de NFTs',
    excerpt: 'O que você realmente possui ao comprar um NFT, e o que continua pertencendo ao criador.',
    category: 'fundamentos',
    readingMinutes: 6,
    publishedAt: '2026-05-12T09:00:00.000Z',
    featured: true,
    image: 'artwork-03',
    author: 'Equipe Kurio',
    sections: [
      ['O que é um token', ['Um NFT é um registro em uma rede blockchain que liga uma carteira a um item digital específico. O registro é público: qualquer pessoa consegue conferir qual carteira detém o token e por qual caminho ele chegou até ali.', 'A obra em si, a imagem, o áudio ou o modelo 3D, costuma ficar armazenada fora da rede. O token guarda uma referência para ela, junto com informações como nome, coleção e atributos.']],
      ['O que você possui de fato', ['Ao comprar, você passa a ser o titular daquele token. Pode exibi-lo, transferi-lo ou revendê-lo, e ninguém altera esse registro sem a chave da sua carteira.', 'Direitos autorais e de uso comercial são outro assunto: salvo indicação em contrário na página do item, eles continuam com quem criou a obra. Vale ler a descrição e as condições de cada coleção antes de comprar.']],
      ['Como confirmar a propriedade', ['Toda compra gera um comprovante com o endereço do contrato e o identificador do token. Com esses dois dados, você confere o titular em qualquer explorador de blockchain, sem depender do marketplace.', 'Guarde o comprovante junto com a sua frase de recuperação em um lugar seguro, mas nunca na mesma pasta.']],
    ],
  },
  {
    slug: '10-artistas-digitais-para-acompanhar',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Uma seleção de nomes que misturam técnica, identidade e coleções consistentes.',
    category: 'arte',
    readingMinutes: 5,
    publishedAt: '2026-05-20T09:00:00.000Z',
    featured: true,
    image: 'artwork-05',
    author: 'Marina Duarte',
    sections: [
      ['Como escolhemos', ['A lista reúne criadores com histórico de lançamentos regulares, comunicação clara sobre edições e procedência verificável. Não é um ranking: é um ponto de partida para quem quer descobrir novos estilos.', 'Procuramos variedade de linguagens, da pixel art à fotografia, passando por arte generativa e escultura 3D.']],
      ['O que observar em cada artista', ['Veja o conjunto da obra antes de olhar o preço. Uma coleção coerente, com séries bem nomeadas e descrições honestas, costuma indicar um trabalho cuidadoso.', 'Confira o selo de verificação, o número de edições e a quantidade de itens ainda disponíveis. Criadores que explicam o processo criativo tendem a manter a comunidade por mais tempo.']],
      ['Por onde começar', ['Abra a página de criadores, filtre pelo estilo que mais chama a sua atenção e visite a coleção principal de cada um. Favoritar é um bom jeito de acompanhar os próximos lançamentos sem pressa.']],
    ],
  },
  {
    slug: 'raridade-atributos-e-procedencia',
    title: 'Raridade, atributos e procedência',
    excerpt: 'Aprenda a ler os detalhes de um item e a comparar peças dentro de uma mesma coleção.',
    category: 'mercado',
    readingMinutes: 6,
    publishedAt: '2026-05-27T09:00:00.000Z',
    featured: true,
    image: 'artwork-08',
    author: 'Rafael Quintana',
    sections: [
      ['Raridade não é só quantidade', ['Uma edição de 1/1 é única, mas isso não a torna automaticamente mais valiosa. A raridade real combina escassez, demanda e a importância do criador para a comunidade.', 'Compare sempre com peças semelhantes da mesma coleção e observe o histórico de vendas.']],
      ['Atributos e características', ['Os atributos descrevem traços do item, como fundo, paleta ou acessórios. Quando poucos itens compartilham um atributo, ele tende a ser considerado mais raro.', 'Use os atributos para filtrar e comparar, mas lembre que gosto pessoal pesa: uma peça comum pode ser a sua favorita.']],
      ['Procedência', ['A procedência é o caminho do item desde a cunhagem até você: quem criou, quem já foi titular e por quais contratos ele passou. Um histórico limpo e documentado dá confiança na compra.', 'Desconfie de itens sem histórico visível ou com descrições que prometem retorno financeiro.']],
    ],
  },
  {
    slug: 'como-proteger-sua-carteira',
    title: 'Como proteger sua carteira',
    excerpt: 'Hábitos simples que evitam a maioria dos golpes e das perdas por descuido.',
    category: 'seguranca',
    readingMinutes: 7,
    publishedAt: '2026-06-02T09:00:00.000Z',
    featured: true,
    image: 'artwork-09',
    author: 'Equipe Kurio',
    sections: [
      ['Frase de recuperação', ['A frase de recuperação dá acesso total à sua carteira. Ninguém legítimo vai pedi-la, nem o suporte do marketplace. Anote em papel e guarde em local seguro, longe de fotos, e-mails e arquivos na nuvem.']],
      ['Antes de assinar', ['Leia o que a carteira mostra antes de confirmar qualquer assinatura. Se a mensagem pede permissão para movimentar todos os seus itens, recuse e confira se o endereço do site é o correto.', 'Use sempre os links oficiais e evite abrir endereços recebidos por mensagem direta.']],
      ['Boas práticas do dia a dia', ['Mantenha uma carteira separada para testes e pequenas compras, e outra, mais protegida, para os itens de maior valor. Ative a autenticação em duas etapas nas contas associadas.', 'Revise de tempos em tempos as permissões concedidas a sites e aplicativos, e revogue as que não usa mais.']],
    ],
  },
  {
    slug: 'o-que-e-uma-edicao-limitada',
    title: 'O que é uma edição limitada',
    excerpt: 'Entenda as edições 1/1, 1/10, 1/50 e abertas e como isso afeta a disponibilidade.',
    category: 'fundamentos',
    readingMinutes: 4,
    publishedAt: '2026-06-09T09:00:00.000Z',
    featured: false,
    image: 'artwork-04',
    author: 'Equipe Kurio',
    sections: [
      ['Tipos de edição', ['Uma edição define quantas cópias de uma obra existem. Na 1/1 há uma única unidade; nas de 10 ou 50, o criador limita a oferta de antemão. Já a edição aberta não tem teto e costuma ter preço menor.']],
      ['Disponibilidade e preço', ['O número de unidades ainda disponíveis aparece na página do item e muda conforme as vendas. Quando chega a zero, a edição fica indisponível, mas a obra pode continuar circulando entre colecionadores.', 'Compare o preço entre edições da mesma obra para entender quanto a escassez pesa na decisão.']],
    ],
  },
  {
    slug: 'taxas-de-rede-sem-misterio',
    title: 'Taxas de rede sem mistério',
    excerpt: 'Por que cada compra tem uma taxa e como escolher a rede que cabe no seu bolso.',
    category: 'mercado',
    readingMinutes: 5,
    publishedAt: '2026-06-16T09:00:00.000Z',
    featured: false,
    image: 'artwork-10',
    author: 'Equipe Kurio',
    sections: [
      ['O que a taxa paga', ['A taxa de rede remunera quem valida as transações na blockchain. Ela não fica com o marketplace nem com o criador, e varia conforme a rede escolhida e o congestionamento do momento.']],
      ['Escolhendo a rede', ['Redes diferentes têm custos bem distintos. Em itens de menor valor, uma taxa alta pode pesar mais que o preço da obra, então vale comparar antes de confirmar.', 'No resumo do pedido, a taxa aparece em linha própria, separada do subtotal, para que o total seja sempre previsível.']],
      ['Dica prática', ['Se você vai comprar mais de um item, reúna tudo no mesmo carrinho: o resumo mostra o total com a taxa da rede escolhida antes do envio.']],
    ],
  },
  {
    slug: 'golpes-comuns-e-como-evita-los',
    title: 'Golpes comuns e como evitá-los',
    excerpt: 'Os truques mais frequentes, de falsos sorteios a páginas clonadas, e sinais de alerta.',
    category: 'seguranca',
    readingMinutes: 6,
    publishedAt: '2026-06-23T09:00:00.000Z',
    featured: false,
    image: 'artwork-06',
    author: 'Equipe Kurio',
    sections: [
      ['Sinais de alerta', ['Pressa excessiva, promessas de ganho garantido e pedidos de dados pessoais são os sinais mais comuns. Se a oferta parece boa demais, provavelmente é.', 'Perfis recém-criados que imitam criadores conhecidos também merecem cautela: confira o selo de verificação e o endereço do perfil.']],
      ['Páginas clonadas', ['Golpistas copiam a aparência de marketplaces para coletar assinaturas. Digite o endereço você mesmo ou use um favorito salvo, e desconfie de links recebidos em mensagens privadas.']],
      ['O que fazer se algo der errado', ['Interrompa qualquer interação, revogue as permissões da carteira e mova os itens restantes para uma carteira nova. Registre tudo e use o canal de denúncia da plataforma.']],
    ],
  },
  {
    slug: 'como-ler-a-pagina-de-um-nft',
    title: 'Como ler a página de um NFT',
    excerpt: 'Um roteiro rápido pelos campos da página de detalhe: edições, contrato, avaliações e histórico.',
    category: 'arte',
    readingMinutes: 4,
    publishedAt: '2026-06-30T09:00:00.000Z',
    featured: false,
    image: 'artwork-18',
    author: 'Marina Duarte',
    sections: [
      ['A obra e a coleção', ['Comece pela imagem e pela descrição. O nome da coleção ajuda a situar o item entre outros do mesmo criador e a descobrir peças relacionadas.']],
      ['Edições e preço', ['Cada edição mostra preço, disponibilidade e limite por pedido. Itens em oferta exibem o preço anterior riscado, para comparação.', 'A escolha da edição fica na URL, então você pode compartilhar exatamente o que está vendo.']],
      ['Contrato, avaliações e procedência', ['As abas reúnem o endereço do contrato, a percentagem de royalties, as avaliações de outros colecionadores e o histórico do item. Reserve um minuto para ler essas informações antes de comprar.']],
    ],
  },
]

const IMAGE_DIMS: Record<string, [number, number]> = {
  'artwork-03': [500, 500],
  'artwork-04': [250, 250],
  'artwork-05': [250, 250],
  'artwork-06': [224, 286],
  'artwork-08': [500, 500],
  'artwork-09': [500, 500],
  'artwork-10': [250, 250],
  'artwork-18': [310, 366],
}

const summaryOf = (a: ArticleSeed): ArticleSummary => {
  const [width, height] = IMAGE_DIMS[a.image]!
  return {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    category: a.category,
    readingMinutes: a.readingMinutes,
    publishedAt: a.publishedAt,
    featured: a.featured,
    image: { src: `/nft/${a.image}.webp`, alt: '', width, height },
  }
}

export function listArticles(q: ArticleListQuery, empty = false): ArticleListResponse {
  const items = empty ? [] : ARTICLE_SEEDS.filter((a) => !q.category || a.category === q.category).map(summaryOf)
  return { items, total: items.length }
}

export function findArticle(slug: string): ArticleDetail | null {
  const seed = ARTICLE_SEEDS.find((a) => a.slug === slug)
  if (!seed) return null
  // Same category first, then the rest in publication order; never the article itself.
  const rank = (a: ArticleSeed, c: ArticleCategory) => (a.category === c ? 0 : 1)
  const related = ARTICLE_SEEDS.filter((a) => a.slug !== slug)
    .sort((a, b) => rank(a, seed.category) - rank(b, seed.category))
    .slice(0, 3)
    .map(summaryOf)
  return {
    ...summaryOf(seed),
    author: seed.author,
    sections: seed.sections.map(([heading, paragraphs]) => ({ heading, paragraphs })),
    related,
  }
}
