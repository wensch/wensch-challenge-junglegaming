import { detail, featured, findNft, listNfts, summary } from '../catalog'
import { db, persist } from '../db'
import { fail, route } from '../http'
import { isActive } from '../scenario-state'

const notFound = (id: string) => fail({ code: 'NOT_FOUND', message: 'NFT não encontrado.', resource: { kind: 'nft', id } })

export const catalogHandlers = [
  route('listNfts', ({ query }) => listNfts(query, isActive('catalog.empty'))),
  route('getFeatured', () => featured()),
  route('getNft', ({ params }) => {
    const nft = findNft(params.nftId!)
    return nft ? detail(nft) : notFound(params.nftId!)
  }),

  route('listFavorites', ({ auth }) => {
    const ids = db().favorites[auth.user!.id] ?? []
    return { nftIds: ids, items: ids.flatMap((id) => (findNft(id) ? [summary(findNft(id)!)] : [])) }
  }),
  route('addFavorite', ({ auth, params }) => {
    const id = params.nftId!
    if (!findNft(id)) notFound(id)
    const list = (db().favorites[auth.user!.id] ??= [])
    if (!list.includes(id)) list.unshift(id)
    persist()
    return { nftId: id, favorited: true }
  }),
  route('removeFavorite', ({ auth, params }) => {
    const id = params.nftId!
    const favorites = db().favorites
    favorites[auth.user!.id] = (favorites[auth.user!.id] ?? []).filter((x) => x !== id)
    persist()
    return { nftId: id, favorited: false }
  }),
]
