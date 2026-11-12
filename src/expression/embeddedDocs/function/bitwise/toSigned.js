export const toSignedDocs = {
  name: 'toSigned',
  category: 'Bitwise',
  syntax: [
    'toSigned(x)',
    'toSigned(x, bits)'
  ],
  description: 'Reinterpret a value as a two\'s complement signed integer of a given bit width, like the C cast (intN_t)x. Non-integer values are truncated towards zero, then wrapped around modulo 2^bits using two\'s complement semantics. The bit width is 32 by default. Results wider than the safe integer range are returned as bigint (or BigNumber when the number type is configured as BigNumber).',
  examples: [
    'toSigned(4294967295, 32)',
    'toSigned(255, 8)',
    'toSigned([128, 255], 8)'
  ],
  seealso: [
    'toUnsigned', 'toHex', 'toBin', 'toOct', 'bigint', 'number'
  ]
}
