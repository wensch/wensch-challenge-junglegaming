/** Display labels for catalog enums (the contract only carries ids). */
import type { CatalogSort, CatalogTab, Category, Network } from '@/api/contracts'

export const CATEGORY_LABELS: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const TAB_LABELS: Record<CatalogTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

export const SORT_LABELS: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  price_asc: 'Preço: menor para maior',
  price_desc: 'Preço: maior para menor',
  name_asc: 'Nome (A–Z)',
}
