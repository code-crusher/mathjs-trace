export const toOctDocs = {
  name: 'toOct',
  category: 'Bitwise',
  syntax: [
    'toOct(x)',
    'toOct(x, bits)'
  ],
  description: 'Format a value as an octal string of a given bit width, zero padded to the full width. The value is truncated towards zero and wrapped around modulo 2^bits using two\'s complement semantics first. The bit width is 32 by default.',
  examples: [
    'toOct(-1, 16)',
    'toOct(8, 8)',
    'toOct(8)'
  ],
  seealso: [
    'toUnsigned', 'toSigned', 'toHex', 'toBin', 'oct'
  ]
}
