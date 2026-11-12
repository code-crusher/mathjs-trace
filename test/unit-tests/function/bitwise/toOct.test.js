// test toOct
import assert from 'assert'

import math from '../../../../src/defaultInstance.js'
const toOct = math.toOct

describe('toOct', function () {
  it('should format a value zero padded to the default width of 32 bits', function () {
    assert.strictEqual(toOct(8), '0o00000000010')
    assert.strictEqual(toOct(0), '0o00000000000')
    assert.strictEqual(toOct(-1), '0o37777777777')
  })

  it('should format a value zero padded to the given width', function () {
    assert.strictEqual(toOct(-1, 16), '0o177777')
    assert.strictEqual(toOct(8, 8), '0o010')
    assert.strictEqual(toOct(1, 4), '0o01')
    assert.strictEqual(toOct(1, 2), '0o1')
    assert.strictEqual(toOct(-1, 64), '0o1' + '7'.repeat(21))
  })

  it('should wrap around values which do not fit in the bit width', function () {
    assert.strictEqual(toOct(8, 3), '0o0')
    assert.strictEqual(toOct(-9, 3), '0o7')
  })

  it('should truncate non-integer values towards zero', function () {
    assert.strictEqual(toOct(-2.5, 8), '0o376')
    assert.strictEqual(toOct(math.bignumber(2.9), 8), '0o002')
    assert.strictEqual(toOct(math.fraction(15, 2), 8), '0o007')
  })

  it('should evaluate element wise on matrices and arrays', function () {
    assert.deepStrictEqual(toOct([-1, 1], 4), ['0o17', '0o01'])

    const result = toOct(math.matrix([-1, 1]), 4)
    assert.ok(result instanceof math.Matrix)
    assert.deepStrictEqual(result.valueOf(), ['0o17', '0o01'])
  })

  it('should throw an error for an invalid bit width', function () {
    assert.throws(() => toOct(1, 0), /Invalid bit width/)
    assert.throws(() => toOct(1, 2.5), /Invalid bit width/)
  })

  it('should throw an error for a non-finite value', function () {
    assert.throws(() => toOct(Infinity), /Cannot cast a non-finite value/)
  })

  it('should throw an error in case of invalid number of arguments', function () {
    assert.throws(() => toOct(), /TypeError: Too few arguments/)
    assert.throws(() => toOct(1, 8, 3), /TypeError: Too many arguments/)
  })
})
