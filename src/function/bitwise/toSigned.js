import { factory } from '../../utils/factory.js'
import { deepMap } from '../../utils/collection.js'
import { castInteger, castResult } from './integerCast.js'

const name = 'toSigned'
const dependencies = ['typed', 'config', '?bignumber']

export const createToSigned = /* #__PURE__ */ factory(name, dependencies, ({ typed, config, bignumber }) => {
  /**
   * Reinterpret a value as a two's complement signed integer of a given bit
   * width, like the C cast `(intN_t)x`.
   *
   * Non-integer values are truncated towards zero first, and then wrapped
   * around modulo `2^bits` using two's complement semantics. So
   * `toSigned(4294967295, 32)` returns `-1` and `toSigned(255, 8)` returns
   * `-1`.
   *
   * The result is a number when it fits in the safe integer range, and a
   * bigint otherwise (or a BigNumber when the configured number type is
   * `'BigNumber'`), so results wider than 2^53 stay exact.
   *
   * For matrices, the function is evaluated element wise.
   *
   * Syntax:
   *
   *    math.toSigned(x)
   *    math.toSigned(x, bits)
   *
   * Examples:
   *
   *    math.toSigned(4294967295, 32)    // returns -1
   *    math.toSigned(255, 8)            // returns -1
   *    math.toSigned(-1, 64)            // returns -1
   *    math.toSigned([128, 255], 8)     // returns [-128, -1]
   *
   * See also:
   *
   *    toUnsigned, bigint, number
   *
   * History:
   *
   *    v15.3  Created
   *
   * @param {number | bigint | BigNumber | Fraction | Array | Matrix} x  Value to reinterpret
   * @param {number | bigint | BigNumber} [bits]  Number of bits, 32 by default
   * @return {number | bigint | BigNumber | Array | Matrix}  The signed value
   */
  return typed(name, {
    'number | bigint | BigNumber | Fraction': function (x) {
      return castResult(castInteger(x, 32, true), config, bignumber)
    },

    'number | bigint | BigNumber | Fraction, number | bigint | BigNumber': function (x, bits) {
      return castResult(castInteger(x, bits, true), config, bignumber)
    },

    'Array | Matrix': typed.referToSelf(self => x => deepMap(x, self)),

    'Array | Matrix, number | bigint | BigNumber': typed.referToSelf(self => (x, bits) => deepMap(x, value => self(value, bits)))
  })
})
