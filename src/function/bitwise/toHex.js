import { factory } from '../../utils/factory.js'
import { deepMap } from '../../utils/collection.js'
import { formatInteger } from './integerCast.js'

const name = 'toHex'
const dependencies = ['typed']

export const createToHex = /* #__PURE__ */ factory(name, dependencies, ({ typed }) => {
  /**
   * Format a value as a hexadecimal string of a given bit width, zero padded
   * to the full width, like the C `%x` format specifier.
   *
   * The value is truncated towards zero and wrapped around modulo `2^bits`
   * using two's complement semantics first, so `toHex(-1, 16)` returns
   * `'0xFFFF'`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.toHex(x)
   *    math.toHex(x, bits)
   *
   * Examples:
   *
   *    math.toHex(-1, 16)     // returns "0xFFFF"
   *    math.toHex(255)        // returns "0x000000FF"
   *    math.toHex(255, 8)     // returns "0xFF"
   *    math.toHex([-1, 1], 8) // returns ["0xFF", "0x01"]
   *
   * See also:
   *
   *    toUnsigned, toSigned, toBin, toOct, hex
   *
   * History:
   *
   *    v15.3  Created
   *
   * @param {number | bigint | BigNumber | Fraction | Array | Matrix} x  Value to format
   * @param {number | bigint | BigNumber} [bits]  Number of bits, 32 by default
   * @return {string | Array | Matrix}  The hexadecimal representation of the bit pattern
   */
  return typed(name, {
    'number | bigint | BigNumber | Fraction': function (x) {
      return formatInteger(x, 32, 16)
    },

    'number | bigint | BigNumber | Fraction, number | bigint | BigNumber': function (x, bits) {
      return formatInteger(x, bits, 16)
    },

    'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self)),

    'Array | Matrix, number | bigint | BigNumber': typed.referToSelf(self => (x, bits) => deepMap(x, value => self(value, bits)))
  })
})
