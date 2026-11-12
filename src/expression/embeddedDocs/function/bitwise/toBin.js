export const toBinDocs = {
  name: 'toBin',
  category: 'Bitwise',
  syntax: [
    'toBin(x)',
    'toBin(x, bits)'
  ],
  description: 'Format a value as a binary string of a given bit width, zero padded to the full width. The value is truncated towards zero and wrapped around modulo 2^bits using two\'s complement semantics first. The bit width is 32 by default.',
  examples: [
    'toBin(-1, 8)',
    'toBin(5, 4)',
    'toBin(5)'
  ],
  seealso: [
    'toUnsigned', 'toSigned', 'toHex', 'toOct', 'bin'
  ]
}
