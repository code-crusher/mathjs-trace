import { factory } from '../../utils/factory.js'
import { deepMap } from '../../utils/collection.js'
import { castInteger, castResult } from './integerCast.js'

const name = 'toUnsigned'
const dependencies = ['typed', 'config', '?bignumber']

export const createToUnsigned = /* #__PURE__ */ factory(name, dependencies, ({ typed, config, bignumber }) => {
  /**
   * Reinterpret a value as an unsigned integer of a given bit width, like the
   * C cast `(uintN_t)x`.
   *
   * Non-integer values are truncated towards zero first, and then wrapped
   * around modulo `2^bits` using two's complement semantics. So
   * `toUnsigned(-1)` returns `4294967295` and `toUnsigned(-2.5, 8)` returns
   * `254`.
   *
   * The result is a number when it fits in the safe integer range, and a
   * bigint otherwise (or a BigNumber when the configured number type is
   * `'BigNumber'`), so results wider than 2^53 stay exact.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.toUnsigned(x)
   *    math.toUnsigned(x, bits)
   *
   * Examples:
   *
   *    math.toUnsigned(-1)              // returns 4294967295
   *    math.toUnsigned(-1, 64)          // returns 18446744073709551615n
   *    math.toUnsigned(-2.5, 8)         // returns 254
   *    math.toUnsigned(255, 8)          // returns 255
   *    math.toUnsigned([-1, -2], 8)     // returns [255, 254]
   *
   * See also:
   *
   *    toSigned, bigint, number
   *
   * History:
   *
   *    v15.3  Created
   *
   * @param {number | bigint | BigNumber | Fraction | Array | Matrix} x  Value to reinterpret
   * @param {number | bigint | BigNumber} [bits]  Number of bits, 32 by default
   * @return {number | bigint | BigNumber | Array | Matrix}  The unsigned value
   */
  return typed(name, {
    'number | bigint | BigNumber | Fraction': function (x) {
      return castResult(castInteger(x, 32, false), config, bignumber)
    },

    'number | bigint | BigNumber | Fraction, number | bigint | BigNumber': function (x, bits) {
      return castResult(castInteger(x, bits, false), config, bignumber)
    },

    'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self)),

    'Array | Matrix, number | bigint | BigNumber': typed.referToSelf(self => (x, bits) => deepMap(x, value => self(value, bits)))
  })
})
