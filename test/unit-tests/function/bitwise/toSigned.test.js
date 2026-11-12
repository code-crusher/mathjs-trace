// test toSigned
import assert from 'assert'

import math from '../../../../src/defaultInstance.js'
const toSigned = math.toSigned

describe('toSigned', function () {
  it('should reinterpret a large unsigned number as signed with 32 bits by default', function () {
    assert.strictEqual(toSigned(4294967295), -1)
    assert.strictEqual(toSigned(4294967294), -2)
    assert.strictEqual(toSigned(2147483648), -2147483648)
  })

  it('should leave values that already fit in the bit width untouched', function () {
    assert.strictEqual(toSigned(0), 0)
    assert.strictEqual(toSigned(42), 42)
    assert.strictEqual(toSigned(-1), -1)
    assert.strictEqual(toSigned(2147483647), 2147483647)
  })

  it('should wrap around values which do not fit in the bit width', function () {
    assert.strictEqual(toSigned(255, 8), -1)
    assert.strictEqual(toSigned(128, 8), -128)
    assert.strictEqual(toSigned(127, 8), 127)
    assert.strictEqual(toSigned(256, 8), 0)
    assert.strictEqual(toSigned(-129, 8), 127)
  })

  it('should support arbitrary bit widths', function () {
    assert.strictEqual(toSigned(65535, 16), -1)
    assert.strictEqual(toSigned(127, 7), -1)
    assert.strictEqual(toSigned(1, 1), -1)
    assert.strictEqual(toSigned(18446744073709551615n, 64), -1)
  })

  it('should return exact results beyond the safe integer range as bigint', function () {
    assert.strictEqual(toSigned(18446744073709551615n, 64), -1)
    assert.strictEqual(toSigned(9223372036854775808n, 64), -9223372036854775808n)
  })

  it('should truncate non-integer values towards zero', function () {
    assert.strictEqual(toSigned(255.9, 8), -1)
    assert.strictEqual(toSigned(-1.5, 8), -1)
    assert.strictEqual(toSigned(math.bignumber(255.9), 8), -1)
    assert.strictEqual(toSigned(math.fraction(511, 2), 8), -1)
  })

  it('should accept a bigint value and bit width', function () {
    assert.strictEqual(toSigned(4294967295n, 32n), -1)
  })

  it('should return a BigNumber when the number type is configured as BigNumber', function () {
    const bigmath = math.create({ number: 'BigNumber' })
    const result = bigmath.toSigned(bigmath.bignumber('9223372036854775808'), 64)
    assert.strictEqual(bigmath.typeOf(result), 'BigNumber')
    assert.strictEqual(result.toString(), '-9223372036854775808')
  })

  it('should evaluate element wise on matrices and arrays', function () {
    assert.deepStrictEqual(toSigned([128, 255], 8), [-128, -1])
    assert.deepStrictEqual(toSigned([[128], [255]], 8), [[-128], [-1]])

    const result = toSigned(math.matrix([128, 255]), 8)
    assert.ok(result instanceof math.Matrix)
    assert.deepStrictEqual(result.valueOf(), [-128, -1])
  })

  it('should round-trip with toUnsigned', function () {
    for (const value of [-1, 0, 1, 42, -2147483648, 2147483647]) {
      assert.strictEqual(toSigned(math.toUnsigned(value, 32), 32), value)
    }
  })

  it('should throw an error for an invalid bit width', function () {
    assert.throws(() => toSigned(1, 0), /Invalid bit width/)
    assert.throws(() => toSigned(1, -8), /Invalid bit width/)
    assert.throws(() => toSigned(1, 2.5), /Invalid bit width/)
  })

  it('should throw an error for a non-finite value', function () {
    assert.throws(() => toSigned(Infinity), /Cannot cast a non-finite value/)
    assert.throws(() => toSigned(NaN), /Cannot cast a non-finite value/)
  })

  it('should implicitly convert a string or boolean to a number', function () {
    assert.strictEqual(toSigned('4294967295', 32), -1)
    assert.strictEqual(toSigned(true, 8), 1)
    assert.strictEqual(toSigned(false, 8), 0)
  })

  it('should throw an error for an unsupported type', function () {
    assert.throws(() => toSigned(math.unit('5 cm')), /TypeError: Unexpected type of argument/)
  })

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(() => toSigned(), /TypeError: Too few arguments/)
    assert.throws(() => toSigned(1, 8, 3), /TypeError: Too many arguments/)
  })
})
