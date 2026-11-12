export const toUnsignedDocs = {
  name: 'toUnsigned',
  category: 'Bitwise',
  syntax: [
    'toUnsigned(x)',
    'toUnsigned(x, bits)'
  ],
  description: 'Reinterpret a value as an unsigned integer of a given bit width, like the C cast (uintN_t)x. Non-integer values are truncated towards zero, then wrapped around modulo 2^bits using two\'s complement semantics. The bit width is 32 by default. Results wider than the safe integer range are returned as bigint (or BigNumber when the number type is configured as BigNumber).',
  examples: [
    'toUnsigned(-1)',
    'toUnsigned(-1, 64)',
    'toUnsigned(-2.5, 8)',
    'toUnsigned([-1, -2], 8)'
  ],
  seealso: [
    'toSigned', 'toHex', 'toBin', 'toOct', 'bigint', 'number'
  ]
}
