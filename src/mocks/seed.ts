/**
 * Deterministic seed (fixed PRNG seed + fixed base date). Everything fictitious lives here.
 * Credentials are documented in src/mocks/README.md.
 */
import { CATEGORIES, type Category, type Image, type Coupon, type Edition, type Network, type Order, type ReceiptLine } from '@/api/contracts'
import { add, mulQty, percentOf, sub, sum } from '@/lib/money'
import { hashPassword } from './crypto'
import { DB_VERSION, type CartRec, type DbState, type NftRec, type UserRec, type WalletRec } from './db'
import { NETWORK_FEES } from './fees'
import { createRng, SEED, type Rng } from './rng'

export const SEED_BASE_DATE = Date.parse('2026-06-01T12:00:00.000Z')
const HOUR = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()

export const SEED_USERS = [
  { id: 'usr_001', email: 'alice@example.test', username: 'alice', displayName: 'Alice Colecionadora', password: 'Senha@123', salt: 'seed-salt-alice-0001' },
  { id: 'usr_002', email: 'bob@example.test', username: 'bob', displayName: 'Bob Artista', password: 'Senha@456', salt: 'seed-salt-bob-0002' },
] as const

const COUPONS: Coupon[] = [
  { code: 'WELCOME10', label: 'Boas-vindas 10%', kind: 'percent', value: '10', expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'LANCAMENTO', label: 'Desconto do lançamento', kind: 'fixed', value: '0.05', expiresAt: null },
  { code: 'BLACK2024', label: 'Black Friday 2024', kind: 'percent', value: '30', expiresAt: '2024-12-01T00:00:00.000Z' },
]

const COLLECTIONS: { id: string; name: string; category: Category }[] = [
  { id: 'col_aurora', name: 'Aurora Digital', category: 'arte-digital' },
  { id: 'col_pixel', name: 'Pixel Atelier', category: 'arte-digital' },
  { id: 'col_lume', name: 'Lume Fotografia', category: 'fotografia' },
  { id: 'col_ondas', name: 'Ondas Sonoras', category: 'musica' },
  { id: 'col_volume', name: 'Volume 3D', category: 'arte-3d' },
  { id: 'col_relic', name: 'Relíquias Raras', category: 'colecionaveis' },
  { id: 'col_algo', name: 'Algoritmo Vivo', category: 'generativa' },
  { id: 'col_arena', name: 'Arena Pixelada', category: 'jogos' },
  { id: 'col_passe', name: 'Passe Livre', category: 'assinaturas' },
  { id: 'col_chave', name: 'Chave Mestra', category: 'utilidade' },
  { id: 'col_neon', name: 'Neon Noturno', category: 'arte-digital' },
  { id: 'col_terra', name: 'Terra Firme', category: 'fotografia' },
]

const IMAGES = [
  { file: 'artwork-03', width: 500, height: 500 },
  { file: 'artwork-04', width: 250, height: 250 },
  { file: 'artwork-05', width: 250, height: 250 },
  { file: 'artwork-06', width: 224, height: 286 },
  { file: 'artwork-08', width: 500, height: 500 },
  { file: 'artwork-09', width: 500, height: 500 },
  { file: 'artwork-10', width: 250, height: 250 },
  { file: 'artwork-18', width: 310, height: 366 },
] as const

const WORDS_A = ['Aurora', 'Cidade', 'Eco', 'Fragmento', 'Horizonte', 'Jardim', 'Labirinto', 'Maré', 'Névoa', 'Órbita', 'Prisma', 'Quimera', 'Relâmpago', 'Santuário', 'Totem', 'Umbral', 'Vórtice', 'Zênite', 'Brasa', 'Cristal']
const WORDS_B = ['Neon', 'Submersa', 'Dourado', 'Cósmico', 'Silencioso', 'Elétrico', 'Perdido', 'Líquido', 'Lunar', 'Digital', 'Ancestral', 'Fractal', 'Selvagem', 'Etéreo', 'Sintético', 'Vermelho', 'Boreal', 'Tropical', 'Quântico', 'Onírico']
const PRICE_TIERS = ['0.016', '0.045', '0.08', '0.12', '0.25', '0.5', '0.89', '1.19', '1.5', '2.35', '4.2', '8.9', '26.846']
const SOLD_OUT_INDEXES = new Set([9, 13, 22, 31])
const NFT_COUNT = 36 // 4 pages of CATALOG_PAGE_SIZE (9), as in the Figma pagination
/** Figma "Início" grid, page 1 (default sort = listed recently = seed order). Card 8 has no text in the layout: name/price are invented. */
const FIGMA_FIRST_PAGE: { name: string; tokenId: string; price: string; compareAt: string | null; image: (typeof IMAGES)[number]['file'] }[] = [
  { name: 'Emerald Ape', tokenId: '#042', price: '1.19', compareAt: null, image: 'artwork-03' },
  { name: 'Sage Nomad', tokenId: '#009', price: '1.69', compareAt: null, image: 'artwork-04' },
  { name: 'Neon Vessel', tokenId: '#552', price: '1.99', compareAt: '2.29', image: 'artwork-05' },
  { name: 'Cosmic Bloom', tokenId: '#118', price: '1.29', compareAt: null, image: 'artwork-06' },
  { name: 'Violet Nomad', tokenId: '#314', price: '1.39', compareAt: null, image: 'artwork-04' },
  { name: 'Ivory Baron', tokenId: '#088', price: '1.79', compareAt: null, image: 'artwork-08' },
  { name: 'Golden Beat', tokenId: '#207', price: '0.99', compareAt: null, image: 'artwork-09' },
  { name: 'Amber Echo', tokenId: '#233', price: '0.79', compareAt: null, image: 'artwork-10' },
  { name: 'Golden Signal', tokenId: '#160', price: '0.39', compareAt: null, image: 'artwork-09' },
]

function applyFigmaFirstPage(nfts: NftRec[]): void {
  FIGMA_FIRST_PAGE.forEach((f, i) => {
    const n = nfts[i]!
    const img = IMAGES.find((x) => x.file === f.image)!
    const image = i === 0
      ? { src: '/nft/hero-emerald-ape.webp', alt: `Arte do NFT ${f.name}`, width: 1350, height: 1350 } // 3x art delivered for the Hero
      : { src: `/nft/${img.file}.png`, alt: `Arte do NFT ${f.name}`, width: img.width, height: img.height }
    if (i === 0) n.isTrending = true // Hero slide 1 = Emerald Ape
    const d = n.editions[0]!
    n.name = f.name
    n.tokenId = f.tokenId
    n.image = image
    n.gallery = [image]
    d.price = f.price
    d.compareAtPrice = f.compareAt
    n.description = `${f.name}, da coleção ${n.collection.name}: uma peça única em edição controlada.`
    n.longDescription = [`${f.name} nasceu de um estudo sobre luz e memória, combinando camadas geradas à mão e processamento digital.`, n.longDescription[1]!]
  })
}

const REVIEWERS = ['Marina C.', 'Rafael T.', 'Luiza P.', 'Gustavo A.', 'Helena M.', 'Diego F.']
const REVIEW_TEXTS = ['Obra incrível, o detalhe ao vivo é ainda melhor.', 'Entrega rápida e transferência sem problemas.', 'Combina muito com a minha coleção.', 'Vale cada centavo, recomendo.', 'A edição limitada faz toda a diferença.']

function makeEditions(i: number, rng: Rng, basePrice: string, soldOut: boolean): Edition[] {
  const n = String(i + 1).padStart(3, '0')
  const pattern = i % 6
  const make = (k: number, kind: Edition['kind'], price: string): Edition => {
    const supply = kind === '1/1' ? 1 : kind === '1/10' ? 10 : kind === '1/50' ? 50 : null
    const stock = supply === null ? rng.int(120, 900) : rng.int(1, supply)
    return {
      id: `ed_${n}_${k}`,
      kind,
      label: kind === 'open' ? 'ABERTA' : kind,
      supply,
      available: soldOut ? 0 : kind === '1/1' ? 1 : stock,
      maxPerOrder: kind === '1/1' ? 1 : kind === '1/10' ? 3 : kind === '1/50' ? 5 : 10,
      price,
      compareAtPrice: null,
    }
  }
  const p50 = percentOf(basePrice, '60')
  const p0 = percentOf(basePrice, '25')
  let eds: Edition[]
  switch (pattern) {
    case 0: eds = [make(1, '1/1', basePrice)]; break
    case 1: eds = [make(1, '1/10', basePrice), make(2, 'open', p0)]; break
    case 2: eds = [make(1, '1/50', p50)]; break
    case 3: eds = [make(1, 'open', p0)]; break
    case 4: eds = [make(1, '1/10', basePrice), make(2, '1/50', p50), make(3, 'open', p0)]; break
    default: eds = [make(1, '1/1', basePrice), make(2, '1/50', p50)]
  }
  // Some NFTs keep one edition sold out while others remain (partial availability).
  if (!soldOut && eds.length > 1 && i % 9 === 2) eds[eds.length - 1] = { ...eds[eds.length - 1]!, available: 0 }
  if (!soldOut && rng.chance(0.2)) {
    const d = eds[0]!
    d.compareAtPrice = add(d.price, percentOf(d.price, '25'))
  }
  return eds
}

type SeedImage = (typeof IMAGES)[number]

/** Own artwork first, then 3 other artworks from `public/nft/` in a stable, index-based order (no PRNG draws). */
function makeGallery(i: number, own: SeedImage, name: string): Image[] {
  const others = IMAGES.filter((x) => x.file !== own.file)
  const picks = [0, 1, 2].map((k) => others[(i + k * 2) % others.length]!)
  return [own, ...picks].map((img, k) => ({
    src: `/nft/${img.file}.png`,
    alt: k === 0 ? `Arte do NFT ${name}` : `Arte do NFT ${name}, imagem ${k + 1} de 4`,
    width: img.width,
    height: img.height,
  }))
}

/** nft_001 reproduces the Figma detail screen exactly (applied after the PRNG draws, so the other NFTs are unchanged). */
function applyFigmaHero(nft: NftRec): NftRec {
  const ed = (k: number, kind: Edition['kind'], price: string, available: number, maxPerOrder: number): Edition => ({
    id: `ed_001_${k}`,
    kind,
    label: kind === 'open' ? 'ABERTA' : kind,
    supply: kind === '1/1' ? 1 : kind === '1/10' ? 10 : kind === '1/50' ? 50 : null,
    available,
    maxPerOrder,
    price,
    compareAtPrice: null,
  })
  const name = 'Emerald Ape #042'
  return {
    ...nft,
    name,
    tokenId: '#0042',
    collection: { id: nft.collection.id, name: 'Kurio Apes' },
    network: 'ethereum',
    defaultEditionId: 'ed_001_3',
    editions: [ed(1, '1/1', '1.99', 1, 1), ed(2, '1/10', '1.69', 6, 3), ed(3, '1/50', '1.19', 32, 5), ed(4, 'open', '0.39', 480, 10)],
    description: 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
    longDescription: [
      'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.',
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    gallery: nft.gallery.map((g, k) => (k === 0 ? { ...g, alt: `Arte do NFT ${name}` } : { ...g, alt: `Arte do NFT ${name}, imagem ${k + 1} de 4` })),
    image: { ...nft.image, alt: `Arte do NFT ${name}` },
    attributes: ['Óculos', 'Esmeralda', 'Raro'],
    contract: { address: '0x7A42...19E8', standard: 'ERC-721' },
    royaltyPercent: '5',
    rating: { average: '4.8', count: 19 },
    provenance: 'Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.',
  }
}

function makeNfts(rng: Rng): NftRec[] {
  const used = new Set<string>()
  const list: NftRec[] = Array.from({ length: NFT_COUNT }, (_, i): NftRec => {
    const pickName = () => `${rng.pick(WORDS_A)} ${rng.pick(WORDS_B)}`
    let name = pickName()
    while (used.has(name)) name = pickName()
    used.add(name)
    const category = CATEGORIES[i % CATEGORIES.length]!
    const cols = COLLECTIONS.filter((c) => c.category === category)
    // Alternate between the first two collections of the category so every collection has siblings ("Mais desta coleção").
    rng.int(0, cols.length - 1)
    const col = cols[Math.floor(i / CATEGORIES.length) % Math.min(2, cols.length)]!
    const network: Network = i % 5 === 3 ? 'solana' : i % 3 === 1 ? 'polygon' : 'ethereum'
    const img = IMAGES[(i * 3 + (i >> 3)) % IMAGES.length]!
    const basePrice = rng.pick(PRICE_TIERS)
    const soldOut = SOLD_OUT_INDEXES.has(i)
    const editions = makeEditions(i, rng, basePrice, soldOut)
    const n = String(i + 1).padStart(3, '0')
    const reviewCount = rng.int(2, 3)
    return {
      id: `nft_${n}`,
      name,
      tokenId: `#${String(rng.int(1, 9999)).padStart(4, '0')}`,
      collection: { id: col.id, name: col.name },
      category,
      network,
      image: { src: `/nft/${img.file}.png`, alt: `Arte do NFT ${name}`, width: img.width, height: img.height },
      defaultEditionId: editions[0]!.id,
      listedAt: iso(SEED_BASE_DATE - i * 31 * HOUR - rng.int(0, 20) * HOUR),
      isNew: i < 14,
      isTrending: i % 3 === 1,
      version: 1,
      description: `${name}, da coleção ${col.name}: uma peça única em edição controlada.`,
      longDescription: [
        `${name} nasceu de um estudo sobre luz e memória, combinando camadas geradas à mão e processamento digital.`,
        `Cada edição é registrada na rede ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'} e acompanha direitos de exibição pessoal.`,
      ],
      gallery: makeGallery(i, img, name),
      attributes: [`Estilo: ${rng.pick(WORDS_B)}`, `Paleta: ${rng.pick(WORDS_B)}`, `Raridade: ${i % 6 === 0 ? 'Lendária' : i % 3 === 0 ? 'Rara' : 'Comum'}`],
      contract: { address: network === 'solana' ? `So${rng.hex(30)}`.replace(/0/g, 'a') : `0x${rng.hex(40)}`, standard: network === 'solana' ? 'SPL' : i % 4 === 0 ? 'ERC-1155' : 'ERC-721' },
      royaltyPercent: rng.pick(['5', '7.5', '10']),
      rating: { average: `${rng.int(3, 4)}.${rng.int(0, 9)}`, count: rng.int(3, 240) },
      reviews: Array.from({ length: reviewCount }, (_, k) => ({
        id: `rev_${n}_${k + 1}`,
        author: rng.pick(REVIEWERS),
        rating: rng.int(4, 5),
        text: rng.pick(REVIEW_TEXTS),
        createdAt: iso(SEED_BASE_DATE - (k + 1) * 40 * HOUR),
      })),
      provenance: `Criado por ${col.name} em ${new Date(SEED_BASE_DATE - (i + 30) * 24 * HOUR).getUTCFullYear()}; primeira listagem no marketplace.`,
      editions,
    }
  })
  list[0] = applyFigmaHero(list[0]!)
  return list
}

async function makeUser(u: (typeof SEED_USERS)[number]): Promise<UserRec> {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: null,
    ensName: `${u.username}.eth`,
    walletAlias: `Carteira de ${u.username}`,
    salt: u.salt,
    passwordHash: await hashPassword(u.password, u.salt),
    version: 1,
    createdAt: iso(SEED_BASE_DATE - 90 * 24 * HOUR),
    updatedAt: iso(SEED_BASE_DATE - 90 * 24 * HOUR),
  }
}

function makeWallet(id: string, userId: string, slot: 'primary' | 'secondary', rng: Rng, u: (typeof SEED_USERS)[number]): WalletRec {
  const at = iso(SEED_BASE_DATE - 60 * 24 * HOUR)
  return {
    id,
    userId,
    slot,
    displayName: u.displayName,
    label: slot === 'primary' ? 'Carteira principal' : 'Carteira reserva',
    profileName: u.username,
    network: 'ethereum',
    address: `0x${rng.hex(40)}`,
    alternateAddress: null,
    type: slot === 'primary' ? 'metamask' : 'walletconnect',
    referralCode: slot === 'primary' ? 'ALICE-2026' : 'BOB-2026',
    email: u.email,
    ensName: `${u.username}.eth`,
    version: 1,
    createdAt: at,
    updatedAt: at,
  }
}

function makeOrder(id: string, user: (typeof SEED_USERS)[number], wallet: WalletRec, nfts: NftRec[], picks: [number, number][], daysAgo: number, rng: Rng): Order {
  const lines: ReceiptLine[] = picks.map(([nftIdx, qty], k) => {
    const nft = nfts[nftIdx]!
    const ed = nft.editions[0]!
    return {
      cartLineId: `${id}_ln${k + 1}`,
      nftId: nft.id,
      editionId: ed.id,
      name: nft.name,
      tokenId: nft.tokenId,
      editionLabel: ed.label,
      image: nft.image,
      quantity: qty,
      unitPrice: ed.price,
      lineTotal: mulQty(ed.price, qty),
    }
  })
  const subtotal = sum(lines.map((l) => l.lineTotal))
  const networkFee = NETWORK_FEES.ethereum
  const at = iso(SEED_BASE_DATE - daysAgo * 24 * HOUR)
  const hash = `0x${rng.hex(64)}`
  return {
    id,
    userId: user.id,
    status: 'confirmed',
    version: 2,
    quoteId: `q_seed_${id}`,
    quoteVersion: 1,
    receipt: {
      lines,
      subtotal,
      couponCode: null,
      discount: '0',
      networkFee,
      total: add(sub(subtotal, '0'), networkFee),
      network: 'ethereum',
      wallet: { id: wallet.id, label: wallet.label, address: wallet.address, type: wallet.type },
      collector: {
        displayName: user.displayName,
        username: user.username,
        profileName: user.username,
        email: user.email,
        ensName: `${user.username}.eth`,
        referralCode: wallet.referralCode,
      },
    },
    transaction: { hash, explorerUrl: `https://etherscan.io/tx/${hash}`, confirmedAt: at },
    declineReason: null,
    createdAt: at,
    updatedAt: at,
  }
}

export async function buildSeed(): Promise<DbState> {
  const rng = createRng(SEED)
  const nfts = makeNfts(rng)
  applyFigmaFirstPage(nfts)
  const [alice, bob] = SEED_USERS
  const users = await Promise.all(SEED_USERS.map(makeUser))
  const wAlice = makeWallet('wal_001', alice.id, 'primary', rng, alice)
  const wAlice2 = makeWallet('wal_002', alice.id, 'secondary', rng, alice)
  const wBob = makeWallet('wal_003', bob.id, 'primary', rng, bob)
  const orders = [
    makeOrder('ord_0001', alice, wAlice, nfts, [[0, 1], [5, 1]], 12, rng),
    makeOrder('ord_0002', alice, wAlice, nfts, [[8, 2]], 5, rng),
    makeOrder('ord_0003', bob, wBob, nfts, [[2, 1]], 3, rng),
  ]
  const emptyCart = (ownerKey: string, id: string): CartRec => ({ id, ownerKey, lines: [], couponCode: null, version: 1, updatedAt: iso(SEED_BASE_DATE) })
  return {
    schema: DB_VERSION,
    seq: { ord: 3, ln: 0, evt: 0, cart: 0, wal: 3, con: 0, usr: 2, q: 0 },
    nfts,
    coupons: COUPONS,
    users,
    sessions: [],
    favorites: { [alice.id]: [nfts[1]!.id, nfts[7]!.id, nfts[12]!.id], [bob.id]: [nfts[3]!.id] },
    carts: { [`u:${alice.id}`]: emptyCart(`u:${alice.id}`, `cart_u_${alice.id}`), [`u:${bob.id}`]: emptyCart(`u:${bob.id}`, `cart_u_${bob.id}`) },
    wallets: [wAlice, wAlice2, wBob],
    connections: [],
    quotes: {},
    orders,
    orderMeta: {},
    idempotency: {},
  }
}
