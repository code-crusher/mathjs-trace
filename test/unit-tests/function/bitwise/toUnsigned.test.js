// test toUnsigned
import assert from 'assert'

import math from '../../../../src/defaultInstance.js'
const toUnsigned = math.toUnsigned

describe('toUnsigned', function () {
  it('should reinterpret a negative number as unsigned with 32 bits by default', function () {
    assert.strictEqual(toUnsigned(-1), 4294967295)
    assert.strictEqual(toUnsigned(-2), 4294967294)
  })

  it('should leave values that already fit in the bit width untouched', function () {
    assert.strictEqual(toUnsigned(0), 0)
    assert.strictEqual(toUnsigned(42), 42)
    assert.strictEqual(toUnsigned(4294967295), 4294967295)
  })

  it('should wrap around values which do not fit in the bit width', function () {
    assert.strictEqual(toUnsigned(4294967296), 0)
    assert.strictEqual(toUnsigned(4294967297), 1)
    assert.strictEqual(toUnsigned(256, 8), 0)
    assert.strictEqual(toUnsigned(257, 8), 1)
    assert.strictEqual(toUnsigned(-256, 8), 0)
    assert.strictEqual(toUnsigned(-257, 8), 255)
  })

  it('should support arbitrary bit widths', function () {
    assert.strictEqual(toUnsigned(-1, 8), 255)
    assert.strictEqual(toUnsigned(-1, 16), 65535)
    assert.strictEqual(toUnsigned(-1, 7), 127)
    assert.strictEqual(toUnsigned(-1, 1), 1)
    assert.strictEqual(toUnsigned(-1, 128), 340282366920938463463374607431768211455n)
  })

  it('should return exact results beyond the safe integer range as bigint', function () {
    assert.strictEqual(toUnsigned(-1, 64), 18446744073709551615n)
    assert.strictEqual(toUnsigned(-1, 53), 9007199254740991)
    assert.strictEqual(toUnsigned(-1, 54), 18014398509481983n)
  })

  it('should truncate non-integer values towards zero', function () {
    assert.strictEqual(toUnsigned(-2.5, 8), 254)
    assert.strictEqual(toUnsigned(2.9, 8), 2)
    assert.strictEqual(toUnsigned(-2.9, 8), 254)
    assert.strictEqual(toUnsigned(math.bignumber(-2.5), 8), 254)
    assert.strictEqual(toUnsigned(math.fraction(-5, 2), 8), 254)
  })

  it('should accept a bigint value', function () {
    assert.strictEqual(toUnsigned(-1n), 4294967295)
    assert.strictEqual(toUnsigned(-1n, 64), 18446744073709551615n)
  })

  it('should accept a BigNumber bit width', function () {
    assert.strictEqual(toUnsigned(-1, math.bignumber(8)), 255)
  })

  it('should return a BigNumber when the number type is configured as BigNumber', function () {
    const bigmath = math.create({ number: 'BigNumber' })
    const result = bigmath.toUnsigned(-1, 64)
    assert.strictEqual(bigmath.typeOf(result), 'BigNumber')
    assert.strictEqual(result.toString(), '18446744073709551615')
  })

  it('should evaluate element wise on matrices and arrays', function () {
    assert.deepStrictEqual(toUnsigned([-1, -2], 8), [255, 254])
    assert.deepStrictEqual(toUnsigned([[-1], [-2]], 8), [[255], [254]])

    const result = toUnsigned(math.matrix([-1, -2]), 8)
    assert.ok(result instanceof math.Matrix)
    assert.deepStrictEqual(result.valueOf(), [255, 254])
  })

  it('should throw an error for an invalid bit width', function () {
    assert.throws(() => toUnsigned(1, 0), /Invalid bit width/)
    assert.throws(() => toUnsigned(1, -8), /Invalid bit width/)
    assert.throws(() => toUnsigned(1, 2.5), /Invalid bit width/)
    assert.throws(() => toUnsigned(1, math.bignumber(2.5)), /Invalid bit width/)
  })

  it('should throw an error for a non-finite value', function () {
    assert.throws(() => toUnsigned(Infinity), /Cannot cast a non-finite value/)
    assert.throws(() => toUnsigned(NaN), /Cannot cast a non-finite value/)
  })

  it('should implicitly convert a string or boolean to a number', function () {
    assert.strictEqual(toUnsigned('-1', 8), 255)
    assert.strictEqual(toUnsigned(true, 8), 1)
    assert.strictEqual(toUnsigned(false, 8), 0)
  })

  it('should throw an error for an unsupported type', function () {
    assert.throws(() => toUnsigned(math.unit('5 cm')), /TypeError: Unexpected type of argument/)
  })

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(() => toUnsigned(), /TypeError: Too few arguments/)
    assert.throws(() => toUnsigned(1, 8, 3), /TypeError: Too many arguments/)
  })
})
