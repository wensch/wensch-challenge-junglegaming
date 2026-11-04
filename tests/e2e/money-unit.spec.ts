/**
 * @unit `src/lib/money.ts` in Node (no browser): sum, rounding, 18 decimals, formatEth (MON-1).
 * ETH is always a decimal string; no float anywhere.
 */
import { expect, test } from '@playwright/test'
import { add, compare, formatEth, InvalidEthError, mulQty, normalize, percentOf, sub, subClamped, sum } from '../../src/lib/money'

test.skip(({ isMobile }) => isMobile, 'pure Node checks run on the desktop project only')

test.describe('@unit money', () => {
  test('sum does not suffer from binary float error', () => {
    expect(add('0.1', '0.2')).toBe('0.3')
    expect(sum(['0.1', '0.2', '0.3'])).toBe('0.6')
    expect(sum(['2.38', '8.34', '16.11'])).toBe('26.83')
    expect(sum([])).toBe('0')
  })

  test('subtraction, clamping and percentages stay exact', () => {
    expect(sub('26.846', '0.016')).toBe('26.83')
    expect(() => sub('1', '2')).toThrow(InvalidEthError)
    expect(subClamped('1', '2')).toBe('0')
    expect(percentOf('26.83', '10')).toBe('2.683')
    expect(mulQty('1.19', 2)).toBe('2.38')
    expect(() => mulQty('1.19', 1.5)).toThrow(RangeError)
  })

  test('rounding: 18 decimals are kept, the 19th is truncated toward zero', () => {
    expect(add('0.000000000000000001', '0.000000000000000001')).toBe('0.000000000000000002')
    expect(percentOf('0.000000000000000001', '50')).toBe('0')
    expect(mulQty('0.333333333333333333', 3)).toBe('0.999999999999999999')
    expect(normalize('1.2300')).toBe('1.23')
    expect(normalize('00.5')).toBe('0.5')
  })

  test('inputs outside the format are rejected', () => {
    for (const bad of ['1,5', '-1', '1e3', '', '0.0000000000000000001', ' 1']) expect(() => normalize(bad), bad).toThrow(InvalidEthError)
  })

  test('compare is numeric, not lexicographic', () => {
    expect(compare('9.5', '10')).toBe(-1)
    expect(compare('1.10', '1.1')).toBe(0)
  })

  test('formatEth: minimum 2 decimals, full precision by default, explicit rounding on request', () => {
    expect(formatEth('26.846')).toBe('26.846 ETH')
    expect(formatEth('1.19')).toBe('1.19 ETH')
    expect(formatEth('2')).toBe('2.00 ETH')
    expect(formatEth('0.016')).toBe('0.016 ETH')
    expect(formatEth('0.000000000000000001')).toBe('0.000000000000000001 ETH')
    expect(formatEth('1.23456', { maxDecimals: 2 })).toBe('1.23 ETH')
    expect(formatEth('1.235', { maxDecimals: 2 })).toBe('1.24 ETH')
    expect(formatEth('3', { unit: false })).toBe('3.00')
  })
})
