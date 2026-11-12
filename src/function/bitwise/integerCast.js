import { isBigNumber } from '../../utils/is.js'

/**
 * Maximum and minimum values which can be represented exactly by a number.
 */
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER)

/**
 * Normalize a bit width to a positive bigint. The width can be a number,
 * bigint, or BigNumber.
 * @param {number | bigint | BigNumber} bits
 * @returns {bigint} The normalized bit width
 */
export function normalizeBits (bits) {
  let width

  if (typeof bits === 'bigint') {
    width = bits
  } else if (typeof bits === 'number') {
    if (!Number.isInteger(bits)) {
      throw new Error(`Invalid bit width: ${bits}. The bit width must be a positive integer.`)
    }
    width = BigInt(bits)
  } else if (isBigNumber(bits)) {
    if (!bits.isInteger()) {
      throw new Error(`Invalid bit width: ${bits}. The bit width must be a positive integer.`)
    }
    width = BigInt(bits.toFixed())
  } else {
    throw new TypeError(`Invalid bit width: ${bits}. The bit width must be a positive integer.`)
  }

  if (width <= 0n) {
    throw new Error(`Invalid bit width: ${bits}. The bit width must be a positive integer.`)
  }

  return width
}

/**
 * Convert a numeric value to a bigint, truncating non-integer values towards
 * zero (like a C cast does).
 * @param {number | bigint | BigNumber | Fraction} x
 * @returns {bigint} The truncated integer value
 */
export function toBigInt (x) {
  if (typeof x === 'bigint') {
    return x
  }

  if (typeof x === 'number') {
    if (!Number.isFinite(x)) {
      throw new Error(`Cannot cast a non-finite value: ${x}`)
    }
    return BigInt(Math.trunc(x))
  }

  if (isBigNumber(x)) {
    if (!x.isFinite()) {
      throw new Error(`Cannot cast a non-finite value: ${x}`)
    }
    return BigInt(x.trunc().toFixed())
  }

  if (x && x.isFraction) {
    const numerator = BigInt(x.n)
    const denominator = BigInt(x.d)
    const magnitude = numerator / denominator
    return BigInt(x.s) < 0n ? -magnitude : magnitude
  }

  throw new TypeError(`Cannot cast a value of type "${typeof x}" to an integer`)
}

/**
 * Reinterpret a value at a fixed bit width using two's complement semantics.
 * @param {number | bigint | BigNumber | Fraction} x Value to reinterpret
 * @param {number | bigint | BigNumber} bits Bit width
 * @param {boolean} signed True for a signed interpretation, false for unsigned
 * @returns {bigint} The reinterpreted value
 */
export function castInteger (x, bits, signed) {
  const width = normalizeBits(bits)
  const modulus = 1n << width
  const value = toBigInt(x)
  const wrapped = ((value % modulus) + modulus) % modulus

  return (signed && wrapped >= (modulus >> 1n))
    ? wrapped - modulus
    : wrapped
}

/**
 * Convert an exact bigint result to the type returned by the cast functions:
 * a number when it fits in the safe integer range, otherwise a BigNumber when
 * the number configuration is set to BigNumber, and a bigint otherwise.
 * @param {bigint} value
 * @param {Object} config
 * @param {Function} [bignumber]
 * @returns {number | bigint | BigNumber}
 */
export function castResult (value, config, bignumber) {
  if (value >= MIN_SAFE_INTEGER && value <= MAX_SAFE_INTEGER) {
    return Number(value)
  }

  if (config.number === 'BigNumber' && bignumber) {
    return bignumber(value.toString())
  }

  return value
}

/**
 * Format a value as the unsigned bit pattern of a given width, zero padded
 * to the number of digits needed to represent the full width.
 * @param {number | bigint | BigNumber | Fraction} x Value to format
 * @param {number | bigint | BigNumber} bits Bit width
 * @param {2 | 8 | 16} base The numeric base
 * @returns {string} The formatted value, including the `0b`, `0o`, or `0x` prefix
 */
export function formatInteger (x, bits, base) {
  const width = normalizeBits(bits)
  const modulus = 1n << width
  const value = ((toBigInt(x) % modulus) + modulus) % modulus

  const prefixes = { 2: '0b', 8: '0o', 16: '0x' }
  const digitsPerCharacter = base === 2 ? 1 : (base === 8 ? 3 : 4)
  const length = Math.ceil(Number(width) / digitsPerCharacter)

  let digits = value.toString(base).padStart(length, '0')
  if (base === 16) {
    digits = digits.toUpperCase()
  }

  return prefixes[base] + digits
}
