export const toHexDocs = {
  name: 'toHex',
  category: 'Bitwise',
  syntax: [
    'toHex(x)',
    'toHex(x, bits)'
  ],
  description: 'Format a value as a hexadecimal string of a given bit width, zero padded to the full width. The value is truncated towards zero and wrapped around modulo 2^bits using two\'s complement semantics first. The bit width is 32 by default.',
  examples: [
    'toHex(-1, 16)',
    'toHex(255)',
    'toHex(255, 8)'
  ],
  seealso: [
    'toUnsigned', 'toSigned', 'toBin', 'toOct', 'hex'
  ]
}
