import type { Network } from '@/api/contracts'

/** Flat network fee per chain (kept out of seed.ts so the seed can be a lazy chunk). */
export const NETWORK_FEES: Record<Network, string> = { ethereum: '0.0021', polygon: '0.0003', solana: '0.00005' }
