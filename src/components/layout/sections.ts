/**
 * Areas present in the Figma that are outside the challenge scope (ARCHITECTURE §12). Their links
 * lead to `/em-breve?secao=<id>`, a page that states the area is unavailable — never a fake success.
 */
import { z } from 'zod'

export const UNAVAILABLE_SECTIONS = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  colecao: 'Minha coleção',
  atividade: 'Atividade',
  estudio: 'Estúdio do criador',
  ajuda: 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  seguranca: 'Carteira e segurança',
  politica: 'Política do mercado',
  denunciar: 'Denunciar item',
  'redes-sociais': 'Redes sociais',
  newsletter: 'Newsletter',
} as const

export type UnavailableSection = keyof typeof UNAVAILABLE_SECTIONS
const SECTION_IDS = Object.keys(UNAVAILABLE_SECTIONS) as [UnavailableSection, ...UnavailableSection[]]

export const unavailableSearchSchema = z.object({
  secao: z.enum(SECTION_IDS).optional().catch(undefined),
})
