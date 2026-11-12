// test toBin
import assert from 'assert'

import math from '../../../../src/defaultInstance.js'
const toBin = math.toBin

describe('toBin', function () {
  it('should format a value zero padded to the default width of 32 bits', function () {
    assert.strictEqual(toBin(5), '0b00000000000000000000000000000101')
    assert.strictEqual(toBin(0), '0b00000000000000000000000000000000')
    assert.strictEqual(toBin(-1), '0b11111111111111111111111111111111')
  })

  it('should format a value zero padded to the given width', function () {
    assert.strictEqual(toBin(-1, 8), '0b11111111')
    assert.strictEqual(toBin(5, 4), '0b0101')
    assert.strictEqual(toBin(1, 1), '0b1')
    assert.strictEqual(toBin(-1, 64), '0b' + '1'.repeat(64))
  })

  it('should wrap around values which do not fit in the bit width', function () {
    assert.strictEqual(toBin(16, 4), '0b0000')
    assert.strictEqual(toBin(-17, 4), '0b1111')
  })

  it('should truncate non-integer values towards zero', function () {
    assert.strictEqual(toBin(-2.5, 4), '0b1110')
    assert.strictEqual(toBin(math.bignumber(2.9), 4), '0b0010')
    assert.strictEqual(toBin(math.fraction(7, 2), 4), '0b0011')
  })

  it('should evaluate element wise on matrices and arrays', function () {
    assert.deepStrictEqual(toBin([-1, 1], 4), ['0b1111', '0b0001'])

    const result = toBin(math.matrix([-1, 1]), 4)
    assert.ok(result instanceof math.Matrix)
    assert.deepStrictEqual(result.valueOf(), ['0b1111', '0b0001'])
  })

  it('should throw an error for an invalid bit width', function () {
    assert.throws(() => toBin(1, 0), /Invalid bit width/)
    assert.throws(() => toBin(1, 2.5), /Invalid bit width/)
  })

  it('should throw an error for a non-finite value', function () {
    assert.throws(() => toBin(NaN), /Cannot cast a non-finite value/)
  })

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(() => toBin(), /TypeError: Too few arguments/)
    assert.throws(() => toBin(1, 8, 3), /TypeError: Too many arguments/)
  })
})
