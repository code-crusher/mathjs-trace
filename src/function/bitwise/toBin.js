import { factory } from '../../utils/factory.js'
import { deepMap } from '../../utils/collection.js'
import { formatInteger } from './integerCast.js'

const name = 'toBin'
const dependencies = ['typed']

export const createToBin = /* #__PURE__ */ factory(name, dependencies, ({ typed }) => {
  /**
   * Format a value as a binary string of a given bit width, zero padded to
   * the full width.
   *
   * The value is truncated towards zero and wrapped around modulo `2^bits`
   * using two's complement semantics first, so `toBin(-1, 8)` returns
   * `'0b11111111'`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.toBin(x)
   *    math.toBin(x, bits)
   *
   * Examples:
   *
   *    math.toBin(-1, 8)      // returns "0b11111111"
   *    math.toBin(5)          // returns "0b00000000000000000000000000000101"
   *    math.toBin(5, 4)       // returns "0b0101"
   *    math.toBin([-1, 1], 4) // returns ["0b1111", "0b0001"]
   *
   * See also:
   *
   *    toUnsigned, toSigned, toHex, toOct, bin
   *
   * History:
   *
   *    v15.3  Created
   *
   * @param {number | bigint | BigNumber | Fraction | Array | Matrix} x  Value to format
   * @param {number | bigint | BigNumber} [bits]  Number of bits, 32 by default
   * @return {string | Array | Matrix}  The binary representation of the bit pattern
   */
  return typed(name, {
    'number | bigint | BigNumber | Fraction': function (x) {
      return formatInteger(x, 32, 2)
    },

    'number | bigint | BigNumber | Fraction, number | bigint | BigNumber': function (x, bits) {
      return formatInteger(x, bits, 2)
    },

    'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self)),

    'Array | Matrix, number | bigint | BigNumber': typed.referToSelf(self => (x, bits) => deepMap(x, value => self(value, bits)))
  })
})
