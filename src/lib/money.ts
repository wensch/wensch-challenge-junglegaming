/**
 * ETH money helpers. Inputs and outputs are decimal strings (`/^\d+(\.\d{1,18})?$/`);
 * decimal.js is the only arithmetic engine. Never use Number()/parseFloat/unary + on money
 * (enforced by ESLint for this file and src/api/contracts).
 *
 * The API quote is the source of truth for totals; these helpers exist for display,
 * line subtotals (price x quantity) and comparisons (e.g. detecting a price change).
 */
import Decimal from 'decimal.js'
// Single source of the ETH format: the frozen contract (lib depends on contracts, never the reverse).
import { ETH_PATTERN } from '@/api/contracts/common'

/** Isolated Decimal constructor: 40 significant digits, no exponent notation in toString. */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -40, toExpPos: 40 })
type D = InstanceType<typeof D>

export const ETH_DECIMALS = 18
const ETH_RE = ETH_PATTERN

export class InvalidEthError extends Error {
  constructor(value: unknown) {
    super(`Invalid ETH amount: ${JSON.stringify(value)}`)
    this.name = 'InvalidEthError'
  }
}

export function isEth(value: unknown): value is string {
  return typeof value === 'string' && ETH_RE.test(value)
}

function toD(value: string): D {
  if (!isEth(value)) throw new InvalidEthError(value)
  return new D(value)
}

/** Canonical string: no exponent, no trailing zeros, at most 18 decimals (truncated toward zero). */
function toEth(d: D): string {
  if (d.isNegative() && !d.isZero()) throw new InvalidEthError(d.toString())
  return d.toDecimalPlaces(ETH_DECIMALS, Decimal.ROUND_DOWN).toFixed()
}

/** Normalizes a valid ETH string (e.g. `"1.2300"` -> `"1.23"`, `"00.5"` -> `"0.5"`). */
export function normalize(value: string): string {
  return toEth(toD(value))
}

export function add(a: string, b: string): string {
  return toEth(toD(a).plus(toD(b)))
}

export function sum(values: readonly string[]): string {
  return toEth(values.reduce<D>((acc, v) => acc.plus(toD(v)), new D(0)))
}

/** a - b; throws if the result would be negative (ETH amounts are non-negative). */
export function sub(a: string, b: string): string {
  return toEth(toD(a).minus(toD(b)))
}

/** a - b clamped at zero (e.g. a discount larger than the subtotal). */
export function subClamped(a: string, b: string): string {
  return toEth(D.max(toD(a).minus(toD(b)), 0))
}

/** Unit price x integer quantity. */
export function mulQty(price: string, quantity: number): string {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError(`Quantity must be a non-negative integer, got ${quantity}`)
  return toEth(toD(price).times(quantity))
}

/** Percentage of an amount, `percent` as decimal string ("10", "12.5"). Rounded down to wei. */
export function percentOf(amount: string, percent: string): string {
  return toEth(toD(amount).times(toD(percent)).dividedBy(100))
}

/** -1 | 0 | 1 */
export function compare(a: string, b: string): -1 | 0 | 1 {
  return toD(a).comparedTo(toD(b)) as -1 | 0 | 1
}

export const eq = (a: string, b: string) => compare(a, b) === 0
export const gt = (a: string, b: string) => compare(a, b) > 0
export const lt = (a: string, b: string) => compare(a, b) < 0
export const isZero = (a: string) => toD(a).isZero()

export type FormatEthOptions = {
  /** Minimum fractional digits (layout shows "1.19 ETH", "0.016 ETH"). Default 2. */
  minDecimals?: number
  /**
   * Maximum fractional digits. Default 18 = full precision (no silent rounding).
   * When lower, the value is rounded half-up for display only.
   */
  maxDecimals?: number
  /** Append " ETH". Default true. */
  unit?: boolean
}

/**
 * Display formatting. Uses "." as decimal separator to match the Figma ("26.846 ETH")
 * and never groups thousands. Full precision by default.
 */
export function formatEth(value: string, { minDecimals = 2, maxDecimals = ETH_DECIMALS, unit = true }: FormatEthOptions = {}): string {
  const d = toD(value).toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_UP)
  let text = d.toFixed()
  const [int, frac = ''] = text.split('.')
  const padded = frac.length < minDecimals ? frac.padEnd(minDecimals, '0') : frac
  text = padded ? `${int}.${padded}` : `${int}`
  return unit ? `${text} ETH` : text
}
