import { factory } from '../../utils/factory.js'
import { deepMap } from '../../utils/collection.js'
import { formatInteger } from './integerCast.js'

const name = 'toOct'
const dependencies = ['typed']

export const createToOct = /* #__PURE__ */ factory(name, dependencies, ({ typed }) => {
  /**
   * Format a value as an octal string of a given bit width, zero padded to
   * the full width.
   *
   * The value is truncated towards zero and wrapped around modulo `2^bits`
   * using two's complement semantics first, so `toOct(-1, 16)` returns
   * `'0o177777'`.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.toOct(x)
   *    math.toOct(x, bits)
   *
   * Examples:
   *
   *    math.toOct(-1, 16)     // returns "0o177777"
   *    math.toOct(8, 8)       // returns "0o010"
   *    math.toOct([-1, 1], 4) // returns ["0o17", "0o01"]
   *
   * See also:
   *
   *    toUnsigned, toSigned, toHex, toBin, oct
   *
   * History:
   *
   *    v15.3  Created
   *
   * @param {number | bigint | BigNumber | Fraction | Array | Matrix} x  Value to format
   * @param {number | bigint | BigNumber} [bits]  Number of bits, 32 by default
   * @return {string | Array | Matrix}  The octal representation of the bit pattern
   */
  return typed(name, {
    'number | bigint | BigNumber | Fraction': function (x) {
      return formatInteger(x, 32, 8)
    },

    'number | bigint | BigNumber | Fraction, number | bigint | BigNumber': function (x, bits) {
      return formatInteger(x, bits, 8)
    },

    'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self)),

    'Array | Matrix, number | bigint | BigNumber': typed.referToSelf(self => (x, bits) => deepMap(x, value => self(value, bits)))
  })
})
