// test toHex
import assert from 'assert'

import math from '../../../../src/defaultInstance.js'
const toHex = math.toHex

describe('toHex', function () {
  it('should format a value zero padded to the default width of 32 bits', function () {
    assert.strictEqual(toHex(255), '0x000000FF')
    assert.strictEqual(toHex(0), '0x00000000')
    assert.strictEqual(toHex(-1), '0xFFFFFFFF')
  })

  it('should format a value zero padded to the given width', function () {
    assert.strictEqual(toHex(-1, 16), '0xFFFF')
    assert.strictEqual(toHex(255, 8), '0xFF')
    assert.strictEqual(toHex(1, 4), '0x1')
    assert.strictEqual(toHex(1, 12), '0x001')
    assert.strictEqual(toHex(-1, 64), '0xFFFFFFFFFFFFFFFF')
  })

  it('should use uppercase hexadecimal digits', function () {
    assert.strictEqual(toHex(0xab, 8), '0xAB')
  })

  it('should wrap around values which do not fit in the bit width', function () {
    assert.strictEqual(toHex(256, 8), '0x00')
    assert.strictEqual(toHex(-257, 8), '0xFF')
  })

  it('should truncate non-integer values towards zero', function () {
    assert.strictEqual(toHex(-2.5, 8), '0xFE')
    assert.strictEqual(toHex(math.bignumber(2.9), 8), '0x02')
    assert.strictEqual(toHex(math.fraction(511, 2), 8), '0xFF')
  })

  it('should evaluate element wise on matrices and arrays', function () {
    assert.deepStrictEqual(toHex([-1, 1], 8), ['0xFF', '0x01'])
    assert.deepStrictEqual(toHex([[-1], [1]], 8), [['0xFF'], ['0x01']])

    const result = toHex(math.matrix([-1, 1]), 8)
    assert.ok(result instanceof math.Matrix)
    assert.deepStrictEqual(result.valueOf(), ['0xFF', '0x01'])
  })

  it('should throw an error for an invalid bit width', function () {
    assert.throws(() => toHex(1, 0), /Invalid bit width/)
    assert.throws(() => toHex(1, 2.5), /Invalid bit width/)
  })

  it('should throw an error for a non-finite value', function () {
    assert.throws(() => toHex(Infinity), /Cannot cast a non-finite value/)
  })

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(() => toHex(), /TypeError: Too few arguments/)
    assert.throws(() => toHex(1, 8, 3), /TypeError: Too many arguments/)
  })
})
