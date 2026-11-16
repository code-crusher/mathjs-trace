import { factory } from '../utils/factory.js'
import { isAccessorNode, isConstantNode, isFunctionNode, isOperatorNode, isSymbolNode, rule2Node } from '../utils/is.js'
import { deepMap } from '../utils/collection.js'
import { safeNumberType } from '../utils/number.js'
import { hasOwnProperty } from '../utils/object.js'

const name = 'parse'
const dependencies = [
  'typed',
  'numeric',
  'config',
  'AccessorNode',
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'ConditionalNode',
  'ConstantNode',
  'FunctionAssignmentNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
  'SymbolNode'
]

export const createParse = /* #__PURE__ */ factory(name, dependencies, ({
  typed,
  numeric,
  config,
  AccessorNode,
  ArrayNode,
  AssignmentNode,
  BlockNode,
  ConditionalNode,
  ConstantNode,
  FunctionAssignmentNode,
  FunctionNode,
  IndexNode,
  ObjectNode,
  OperatorNode,
  ParenthesisNode,
  RangeNode,
  RelationalNode,
  SymbolNode
}) => {
  /**
   * Parse an expression. Returns a node tree, which can be evaluated by
   * invoking node.evaluate() or transformed into a functional object via node.compile().
   *
   * Note the evaluating arbitrary expressions may involve security risks,
   * see [https://mathjs.org/docs/expressions/security.html](https://mathjs.org/docs/expressions/security.html) for more information.
   *
   * Syntax:
   *
   *     math.parse(expr)
   *     math.parse(expr, options)
   *     math.parse([expr1, expr2, expr3, ...])
   *     math.parse([expr1, expr2, expr3, ...], options)
   *
   * Example:
   *
   *     const node1 = math.parse('sqrt(3^2 + 4^2)')
   *     node1.compile().evaluate() // 5
   *
   *     let scope = {a:3, b:4}
   *     const node2 = math.parse('a * b')
   *     node2.evaluate(scope) // 12
   *     const code2 = node2.compile()
   *     code2.evaluate(scope) // 12
   *     scope.a = 5
   *     code2.evaluate(scope) // 20
   *
   *     const nodes = math.parse(['a = 3', 'b = 4', 'a * b'])
   *     nodes[2].compile().evaluate() // 12
   *
   * See also:
   *
   *     evaluate, compile
   *
   * History:
   *
   *     v15.1  Add optional chaining operator
   *     v14.8  Add nullish coalescing operator
   *     v12.4  Allow trailing commas in matrices
   *     v9.5   Support for calculations with percentages
   *     v7.3   Supported binary, octal, and hexadecimal notation
   *     v3     Add object notation; allow assignments internal to other
   *            expressions
   *     v0.27  Allow multi-line expressions; allow functions that receive
   *            unevaluated parameters (`rawArgs`)
   *     v0.20  Added ternary conditional
   *     v0.18  Dropped the `function` keyword
   *     v0.14  Added `[1,2;3,4]` notation for matrices
   *     v0.13  Switched to one-based indices
   *     v0.9   Created
   *
   * @param {string | string[] | Matrix} expr          Expression to be parsed
   * @param {{nodes: Object<string, Node>}} [options]  Available options:
   *                                                   - `nodes` a set of custom nodes
   * @return {Node | Node[]} node
   * @throws {Error}
   */
  const parse = typed(name, {
    string: function (expression) {
      return parseStart(expression, {})
    },
    'Array | Matrix': function (expressions) {
      return parseMultiple(expressions, {})
    },
    'string, Object': function (expression, options) {
      const extraNodes = options.nodes !== undefined ? options.nodes : {}

      return parseStart(expression, extraNodes)
    },
    'Array | Matrix, Object': parseMultiple
  })

  function parseMultiple (expressions, options = {}) {
    const extraNodes = options.nodes !== undefined ? options.nodes : {}

    // parse an array or matrix with expressions
    return deepMap(expressions, function (elem) {
      if (typeof elem !== 'string') throw new TypeError('String expected')

      return parseStart(elem, extraNodes)
    })
  }

  // token types enumeration
  const TOKENTYPE = {
    NULL: 0,
    DELIMITER: 1,
    NUMBER: 2,
    SYMBOL: 3,
    UNKNOWN: 4
  }

  // map with all delimiters
  const DELIMITERS = {
    ',': true,
    '(': true,
    ')': true,
    '[': true,
    ']': true,
    '{': true,
    '}': true,
    '"': true,
    '\'': true,
    ';': true,

    '+': true,
    '-': true,
    '*': true,
    '.*': true,
    '/': true,
    './': true,
    '%': true,
    '^': true,
    '.^': true,
    '~': true,
    '!': true,
    '&': true,
    '|': true,
    '^|': true,
    '=': true,
    ':': true,
    '?': true,
    '?.': true,
    '??': true,

    '==': true,
    '!=': true,
    '<': true,
    '>': true,
    '<=': true,
    '>=': true,

    '<<': true,
    '>>': true,
    '>>>': true
  }

  // map with all named delimiters
  const NAMED_DELIMITERS = {
    mod: true,
    to: true,
    in: true,
    and: true,
    xor: true,
    or: true,
    not: true
  }

  const CONSTANTS = {
    true: true,
    false: false,
    null: null,
    undefined
  }

  const NUMERIC_CONSTANTS = [
    'NaN',
    'Infinity'
  ]

  const ESCAPE_CHARACTERS = {
    '"': '"',
    "'": "'",
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t'
    // note that \u is handled separately in parseStringToken()
  }

  function initialState () {
    return {
      extraNodes: {}, // current extra nodes, must be careful not to mutate
      expression: '', // current expression
      comment: '', // last parsed comment
      index: 0, // current index in expr
      token: '', // current token
      tokenType: TOKENTYPE.NULL, // type of the token
      nestingLevel: 0, // level of nesting inside parameters, used to ignore newline characters
      conditionalLevel: null // when a conditional is being parsed, the level of the conditional is stored here
    }
  }

  // The parser state (current expression, index, token, ...) is shared mutable
  // state, private to this factory. All parse* functions operate on it implicitly
  // instead of taking it as an argument, so that a caller can never pass in a
  // mismatched state object. It is initialized at the start of `parseStart`,
  // which saves and restores any previous value so that nested parses (for
  // example a custom node that parses an expression while building itself)
  // cannot corrupt an ongoing parse.
  let state = null

  /**
   * View upto `length` characters of the expression starting at the current character.
   *
   * @param {number} [length=1] Number of characters to view
   * @returns {string}
   * @private
   */
  function currentString (length) {
    return state.expression.substr(state.index, length)
  }

  /**
   * View the current character. Returns '' if end of expression is reached.
   *
   * @returns {string}
   * @private
   */
  function currentCharacter () {
    return currentString(1)
  }

  /**
   * Get the next character from the expression.
   * The character is stored into the char c. If the end of the expression is
   * reached, the function puts an empty string in c.
   * @private
   */
  function next () {
    state.index++
  }

  /**
   * Preview the previous character from the expression.
   * @return {string} cNext
   * @private
   */
  function prevCharacter () {
    return state.expression.charAt(state.index - 1)
  }

  /**
   * Preview the next character from the expression.
   * @return {string} cNext
   * @private
   */
  function nextCharacter () {
    return state.expression.charAt(state.index + 1)
  }

  /**
   * Get next token in the current string expr.
   * The token and token type are available as token and tokenType
   * @private
   */
  function getToken () {
    state.tokenType = TOKENTYPE.NULL
    state.token = ''
    state.comment = ''

    // skip over ignored characters:
    while (true) {
      // comments:
      if (currentCharacter() === '#') {
        while (currentCharacter() !== '\n' &&
               currentCharacter() !== '') {
          state.comment += currentCharacter()
          next()
        }
      }
      // whitespace: space, tab, and newline when inside parameters
      if (parse.isWhitespace(currentCharacter(), state.nestingLevel)) {
        next()
      } else {
        break
      }
    }

    // check for end of expression
    if (currentCharacter() === '') {
      // token is still empty
      state.tokenType = TOKENTYPE.DELIMITER
      return
    }

    // check for new line character
    if (currentCharacter() === '\n' && !state.nestingLevel) {
      state.tokenType = TOKENTYPE.DELIMITER
      state.token = currentCharacter()
      next()
      return
    }

    const c1 = currentCharacter()
    const c2 = currentString(2)
    const c3 = currentString(3)
    if (c3.length === 3 && DELIMITERS[c3]) {
      state.tokenType = TOKENTYPE.DELIMITER
      state.token = c3
      next()
      next()
      next()
      return
    }

    // check for delimiters consisting of 2 characters
    // Special case: the check for '?.' is to prevent a case like 'a?.3:.7' from being interpreted as optional chaining
    // TODO: refactor the tokenization into some better way to deal with cases like 'a?.3:.7', see https://github.com/josdejong/mathjs/pull/3584
    if (
      c2.length === 2 &&
      DELIMITERS[c2] &&
      (c2 !== '?.' || !parse.isDigit(state.expression.charAt(state.index + 2)))
    ) {
      state.tokenType = TOKENTYPE.DELIMITER
      state.token = c2
      next()
      next()
      return
    }

    // check for delimiters consisting of 1 character
    if (DELIMITERS[c1]) {
      state.tokenType = TOKENTYPE.DELIMITER
      state.token = c1
      next()
      return
    }

    // check for a number
    if (parse.isDigitDot(c1)) {
      state.tokenType = TOKENTYPE.NUMBER

      // check for binary, octal, or hex
      const c2 = currentString(2)
      if (c2 === '0b' || c2 === '0o' || c2 === '0x') {
        state.token += currentCharacter()
        next()
        state.token += currentCharacter()
        next()
        while (
          parse.isAlpha(currentCharacter(), prevCharacter(), nextCharacter()) ||
          parse.isDigit(currentCharacter())
        ) {
          state.token += currentCharacter()
          next()
        }
        if (currentCharacter() === '.') {
          // this number has a radix point
          state.token += '.'
          next()
          // get the digits after the radix
          while (
            parse.isAlpha(currentCharacter(), prevCharacter(), nextCharacter()) ||
            parse.isDigit(currentCharacter())
          ) {
            state.token += currentCharacter()
            next()
          }
        } else if (currentCharacter() === 'i') {
          // this number has a word size suffix
          state.token += 'i'
          next()
          // get the word size
          while (parse.isDigit(currentCharacter())) {
            state.token += currentCharacter()
            next()
          }
        }
        return
      }

      // get number, can have a single dot
      if (currentCharacter() === '.') {
        state.token += currentCharacter()
        next()

        if (!parse.isDigit(currentCharacter())) {
          // this is no number, it is just a dot (can be dot notation)
          state.tokenType = TOKENTYPE.DELIMITER
          return
        }
      } else {
        while (parse.isDigit(currentCharacter())) {
          state.token += currentCharacter()
          next()
        }
        if (parse.isDecimalMark(currentCharacter(), nextCharacter())) {
          state.token += currentCharacter()
          next()
        }
      }

      while (parse.isDigit(currentCharacter())) {
        state.token += currentCharacter()
        next()
      }
      // check for exponential notation like "2.3e-4", "1.23e50" or "2e+4"
      if (currentCharacter() === 'E' || currentCharacter() === 'e') {
        if (parse.isDigit(nextCharacter()) || nextCharacter() === '-' || nextCharacter() === '+') {
          state.token += currentCharacter()
          next()

          if (currentCharacter() === '+' || currentCharacter() === '-') {
            state.token += currentCharacter()
            next()
          }
          // Scientific notation MUST be followed by an exponent
          if (!parse.isDigit(currentCharacter())) {
            throw createSyntaxError('Digit expected, got "' + currentCharacter() + '"')
          }

          while (parse.isDigit(currentCharacter())) {
            state.token += currentCharacter()
            next()
          }

          if (parse.isDecimalMark(currentCharacter(), nextCharacter())) {
            throw createSyntaxError('Digit expected, got "' + currentCharacter() + '"')
          }
        } else if (parse.isDecimalMark(nextCharacter(), state.expression.charAt(state.index + 2))) {
          next()
          throw createSyntaxError('Digit expected, got "' + currentCharacter() + '"')
        }
      }

      return
    }

    // check for variables, functions, named operators
    if (parse.isAlpha(currentCharacter(), prevCharacter(), nextCharacter())) {
      while (parse.isAlpha(currentCharacter(), prevCharacter(), nextCharacter()) || parse.isDigit(currentCharacter())) {
        state.token += currentCharacter()
        next()
      }

      if (hasOwnProperty(NAMED_DELIMITERS, state.token)) {
        state.tokenType = TOKENTYPE.DELIMITER
      } else {
        state.tokenType = TOKENTYPE.SYMBOL
      }

      return
    }

    // something unknown is found, wrong characters -> a syntax error
    state.tokenType = TOKENTYPE.UNKNOWN
    while (currentCharacter() !== '') {
      state.token += currentCharacter()
      next()
    }
    throw createSyntaxError('Syntax error in part "' + state.token + '"')
  }

  /**
   * Get next token and skip newline tokens
   */
  function getTokenSkipNewline () {
    do {
      getToken()
    }
    while (state.token === '\n') // eslint-disable-line no-unmodified-loop-condition
  }

  /**
   * Open parameters.
   * New line characters will be ignored until closeParams() is called
   */
  function openParams () {
    state.nestingLevel++
  }

  /**
   * Close parameters.
   * New line characters will no longer be ignored
   */
  function closeParams () {
    state.nestingLevel--
  }

  /**
   * Checks whether the current character `c` is a valid alpha character:
   *
   * - A latin letter (upper or lower case) Ascii: a-z, A-Z
   * - An underscore                        Ascii: _
   * - A dollar sign                        Ascii: $
   * - A latin letter with accents          Unicode: \u00C0 - \u02AF
   * - A greek letter                       Unicode: \u0370 - \u03FF
   * - A mathematical alphanumeric symbol   Unicode: \u{1D400} - \u{1D7FF} excluding invalid code points
   *
   * The previous and next characters are needed to determine whether
   * this character is part of a unicode surrogate pair.
   *
   * @param {string} c      Current character in the expression
   * @param {string} cPrev  Previous character
   * @param {string} cNext  Next character
   * @return {boolean}
   */
  parse.isAlpha = function isAlpha (c, cPrev, cNext) {
    return parse.isValidLatinOrGreek(c) ||
        parse.isValidMathSymbol(c, cNext) ||
        parse.isValidMathSymbol(cPrev, c)
  }

  /**
   * Test whether a character is a valid latin, greek, or letter-like character
   * @param {string} c
   * @return {boolean}
   */
  parse.isValidLatinOrGreek = function isValidLatinOrGreek (c) {
    return /^[a-zA-Z_$\u00C0-\u02AF\u0370-\u03FF\u2100-\u214F]$/.test(c)
  }

  /**
   * Test whether two given 16 bit characters form a surrogate pair of a
   * unicode math symbol.
   *
   * https://unicode-table.com/en/
   * https://www.wikiwand.com/en/Mathematical_operators_and_symbols_in_Unicode
   *
   * Note: In ES6 will be unicode aware:
   * https://stackoverflow.com/questions/280712/javascript-unicode-regexes
   * https://mathiasbynens.be/notes/es6-unicode-regex
   *
   * @param {string} high
   * @param {string} low
   * @return {boolean}
   */
  parse.isValidMathSymbol = function isValidMathSymbol (high, low) {
    return /^[\uD835]$/.test(high) &&
        /^[\uDC00-\uDFFF]$/.test(low) &&
        /^[^\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDFCC\uDFCD]$/.test(low)
  }

  /**
   * Check whether given character c is a white space character: space, tab, or enter
   * @param {string} c
   * @param {number} nestingLevel
   * @return {boolean}
   */
  parse.isWhitespace = function isWhitespace (c, nestingLevel) {
    // TODO: also take '\r' carriage return as newline? Or does that give problems on mac?
    return c === ' ' || c === '\t' || c === '\u00A0' || (c === '\n' && nestingLevel > 0)
  }

  /**
   * Test whether the character c is a decimal mark (dot).
   * This is the case when it's not the start of a delimiter '.*', './', or '.^'
   * @param {string} c
   * @param {string} cNext
   * @return {boolean}
   */
  parse.isDecimalMark = function isDecimalMark (c, cNext) {
    return c === '.' && cNext !== '/' && cNext !== '*' && cNext !== '^'
  }

  /**
   * checks if the given char c is a digit or dot
   * @param {string} c   a string with one character
   * @return {boolean}
   */
  parse.isDigitDot = function isDigitDot (c) {
    return ((c >= '0' && c <= '9') || c === '.')
  }

  /**
   * checks if the given char c is a digit
   * @param {string} c   a string with one character
   * @return {boolean}
   */
  parse.isDigit = function isDigit (c) {
    return (c >= '0' && c <= '9')
  }

  /**
   * Start of the parse levels below, in order of precedence
   * @return {Node} node
   * @private
   */
  function parseStart (expression, extraNodes) {
    // Save the current parser state so that a parse triggered from within
    // another parse (for example when a custom node parses an expression
    // while it is being constructed) cannot corrupt the ongoing parse.
    const previousState = state
    state = initialState()
    Object.assign(state, { expression, extraNodes })

    try {
      getToken()

      const node = parseBlock()

      // check for garbage at the end of the expression
      // an expression ends with a empty character '' and tokenType DELIMITER
      if (state.token !== '') {
        if (state.tokenType === TOKENTYPE.DELIMITER) {
          // user entered a not existing operator like "//"

          // TODO: give hints for aliases, for example with "<>" give as hint " did you mean !== ?"
          throw createError('Unexpected operator ' + state.token)
        } else {
          throw createSyntaxError('Unexpected part "' + state.token + '"')
        }
      }

      return node
    } finally {
      state = previousState
    }
  }

  /**
   * Parse a block with expressions. Expressions can be separated by a newline
   * character '\n', or by a semicolon ';'. In case of a semicolon, no output
   * of the preceding line is returned.
   * @return {Node} node
   * @private
   */
  function parseBlock () {
    let node
    const blocks = []
    let visible

    if (state.token !== '' && state.token !== '\n' && state.token !== ';') {
      node = parseAssignment()
      if (state.comment) {
        node.comment = state.comment
      }
    }

    // TODO: simplify this loop
    while (state.token === '\n' || state.token === ';') { // eslint-disable-line no-unmodified-loop-condition
      if (blocks.length === 0 && node) {
        visible = (state.token !== ';')
        blocks.push({ node, visible })
      }

      getToken()
      if (state.token !== '\n' && state.token !== ';' && state.token !== '') {
        node = parseAssignment()
        if (state.comment) {
          node.comment = state.comment
        }

        visible = (state.token !== ';')
        blocks.push({ node, visible })
      }
    }

    if (blocks.length > 0) {
      return new BlockNode(blocks)
    } else {
      if (!node) {
        node = new ConstantNode(undefined)
        if (state.comment) {
          node.comment = state.comment
        }
      }

      return node
    }
  }

  /**
   * Assignment of a function or variable,
   * - can be a variable like 'a=2.3'
   * - or a updating an existing variable like 'matrix(2,3:5)=[6,7,8]'
   * - defining a function like 'f(x) = x^2'
   * @return {Node} node
   * @private
   */
  function parseAssignment () {
    let name, args, value, valid

    const node = parseConditional()

    if (state.token === '=') {
      if (isSymbolNode(node)) {
        // parse a variable assignment like 'a = 2/3'
        name = node.name
        getTokenSkipNewline()
        value = parseAssignment()
        return new AssignmentNode(new SymbolNode(name), value)
      } else if (isAccessorNode(node)) {
        // parse a matrix subset assignment like 'A[1,2] = 4'
        if (node.optionalChaining) {
          throw createSyntaxError('Cannot assign to optional chain')
        }
        getTokenSkipNewline()
        value = parseAssignment()
        return new AssignmentNode(node.object, node.index, value)
      } else if (isFunctionNode(node) && isSymbolNode(node.fn)) {
        // parse function assignment like 'f(x) = x^2'
        valid = true
        args = []

        name = node.name
        node.args.forEach(function (arg, index) {
          if (isSymbolNode(arg)) {
            args[index] = arg.name
          } else {
            valid = false
          }
        })

        if (valid) {
          getTokenSkipNewline()
          value = parseAssignment()
          return new FunctionAssignmentNode(name, args, value)
        }
      }

      throw createSyntaxError('Invalid left hand side of assignment operator =')
    }

    return node
  }

  /**
   * conditional operation
   *
   *     condition ? truePart : falsePart
   *
   * Note: conditional operator is right-associative
   *
   * @return {Node} node
   * @private
   */
  function parseConditional () {
    let node = parseLogicalOr()

    while (state.token === '?') { // eslint-disable-line no-unmodified-loop-condition
      // set a conditional level, the range operator will be ignored as long
      // as conditionalLevel === state.nestingLevel.
      const prev = state.conditionalLevel
      state.conditionalLevel = state.nestingLevel
      getTokenSkipNewline()

      const condition = node
      const trueExpr = parseAssignment()

      if (state.token !== ':') throw createSyntaxError('False part of conditional expression expected')

      state.conditionalLevel = null
      getTokenSkipNewline()

      const falseExpr = parseAssignment() // Note: check for conditional operator again, right associativity

      node = new ConditionalNode(condition, trueExpr, falseExpr)

      // restore the previous conditional level
      state.conditionalLevel = prev
    }

    return node
  }

  /**
   * logical or, 'x or y'
   * @return {Node} node
   * @private
   */
  function parseLogicalOr () {
    let node = parseLogicalXor()

    while (state.token === 'or') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('or', 'or', [node, parseLogicalXor()])
    }

    return node
  }

  /**
   * logical exclusive or, 'x xor y'
   * @return {Node} node
   * @private
   */
  function parseLogicalXor () {
    let node = parseLogicalAnd()

    while (state.token === 'xor') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('xor', 'xor', [node, parseLogicalAnd()])
    }

    return node
  }

  /**
   * logical and, 'x and y'
   * @return {Node} node
   * @private
   */
  function parseLogicalAnd () {
    let node = parseBitwiseOr()

    while (state.token === 'and') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('and', 'and', [node, parseBitwiseOr()])
    }

    return node
  }

  /**
   * bitwise or, 'x | y'
   * @return {Node} node
   * @private
   */
  function parseBitwiseOr () {
    let node = parseBitwiseXor()

    while (state.token === '|') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('|', 'bitOr', [node, parseBitwiseXor()])
    }

    return node
  }

  /**
   * bitwise exclusive or (xor), 'x ^| y'
   * @return {Node} node
   * @private
   */
  function parseBitwiseXor () {
    let node = parseBitwiseAnd()

    while (state.token === '^|') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('^|', 'bitXor', [node, parseBitwiseAnd()])
    }

    return node
  }

  /**
   * bitwise and, 'x & y'
   * @return {Node} node
   * @private
   */
  function parseBitwiseAnd () {
    let node = parseRelational()

    while (state.token === '&') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('&', 'bitAnd', [node, parseRelational()])
    }

    return node
  }

  /**
   * Parse a chained conditional, like 'a > b >= c'
   * @return {Node} node
   */
  function parseRelational () {
    const params = [parseShift()]
    const conditionals = []

    const operators = {
      '==': 'equal',
      '!=': 'unequal',
      '<': 'smaller',
      '>': 'larger',
      '<=': 'smallerEq',
      '>=': 'largerEq'
    }

    while (hasOwnProperty(operators, state.token)) { // eslint-disable-line no-unmodified-loop-condition
      const cond = { name: state.token, fn: operators[state.token] }
      conditionals.push(cond)
      getTokenSkipNewline()
      params.push(parseShift())
    }

    if (params.length === 1) {
      return params[0]
    } else if (params.length === 2) {
      return new OperatorNode(conditionals[0].name, conditionals[0].fn, params)
    } else {
      return new RelationalNode(conditionals.map(c => c.fn), params)
    }
  }

  /**
   * Bitwise left shift, bitwise right arithmetic shift, bitwise right logical shift
   * @return {Node} node
   * @private
   */
  function parseShift () {
    let node, name, fn, params

    node = parseConversion()

    const operators = {
      '<<': 'leftShift',
      '>>': 'rightArithShift',
      '>>>': 'rightLogShift'
    }

    while (hasOwnProperty(operators, state.token)) {
      name = state.token
      fn = operators[name]

      getTokenSkipNewline()
      params = [node, parseConversion()]
      node = new OperatorNode(name, fn, params)
    }

    return node
  }

  /**
   * conversion operators 'to' and 'in'
   * @return {Node} node
   * @private
   */
  function parseConversion () {
    let node, name, fn, params

    node = parseRange()

    const operators = {
      to: 'to',
      in: 'to' // alias of 'to'
    }

    while (hasOwnProperty(operators, state.token)) {
      name = state.token
      fn = operators[name]

      getTokenSkipNewline()

      if (name === 'in' && '])},;'.includes(state.token)) {
        // end of expression -> this is the unit 'in' ('inch')
        node = new OperatorNode('*', 'multiply', [node, new SymbolNode('in')], true)
      } else {
        // operator 'a to b' or 'a in b'
        params = [node, parseRange()]
        node = new OperatorNode(name, fn, params)
      }
    }

    return node
  }

  /**
   * parse range, "start:end", "start:step:end", ":", "start:", ":end", etc
   * @return {Node} node
   * @private
   */
  function parseRange () {
    let node
    const params = []

    if (state.token === ':') {
      if (state.conditionalLevel === state.nestingLevel) {
        // we are in the midst of parsing a conditional operator, so not
        // a range, but rather an empty true-expr, which is considered a
        // syntax error
        throw createSyntaxError(
          'The true-expression of a conditional operator may not be empty')
      } else {
        // implicit start of range = 1 (one-based)
        node = new ConstantNode(1)
      }
    } else {
      // explicit start
      node = parseAddSubtract()
    }

    if (state.token === ':' && (state.conditionalLevel !== state.nestingLevel)) {
      // we ignore the range operator when a conditional operator is being processed on the same level
      params.push(node)

      // parse step and end
      while (state.token === ':' && params.length < 3) { // eslint-disable-line no-unmodified-loop-condition
        getTokenSkipNewline()

        if (state.token === ')' || state.token === ']' || state.token === ',' || state.token === '') {
          // implicit end
          params.push(new SymbolNode('end'))
        } else {
          // explicit end
          params.push(parseAddSubtract())
        }
      }

      if (params.length === 3) {
        // params = [start, step, end]
        node = new RangeNode(params[0], params[2], params[1]) // start, end, step
      } else { // length === 2
        // params = [start, end]
        node = new RangeNode(params[0], params[1]) // start, end
      }
    }

    return node
  }

  /**
   * add or subtract
   * @return {Node} node
   * @private
   */
  function parseAddSubtract () {
    let node, name, fn, params

    node = parseMultiplyDivideModulus()

    const operators = {
      '+': 'add',
      '-': 'subtract'
    }
    while (hasOwnProperty(operators, state.token)) {
      name = state.token
      fn = operators[name]

      getTokenSkipNewline()
      const rightNode = parseMultiplyDivideModulus()
      if (rightNode.isPercentage) {
        params = [node, new OperatorNode('*', 'multiply', [node, rightNode])]
      } else {
        params = [node, rightNode]
      }
      node = new OperatorNode(name, fn, params)
    }

    return node
  }

  /**
   * multiply, divide, modulus
   * @return {Node} node
   * @private
   */
  function parseMultiplyDivideModulus () {
    let node, last, name, fn

    node = parseImplicitMultiplication()
    last = node

    const operators = {
      '*': 'multiply',
      '.*': 'dotMultiply',
      '/': 'divide',
      './': 'dotDivide',
      '%': 'mod',
      mod: 'mod'
    }

    while (true) {
      if (hasOwnProperty(operators, state.token)) {
        // explicit operators
        name = state.token
        fn = operators[name]
        getTokenSkipNewline()
        last = parseImplicitMultiplication()
        node = new OperatorNode(name, fn, [node, last])
      } else {
        break
      }
    }

    return node
  }

  /**
   * implicit multiplication
   * @return {Node} node
   * @private
   */
  function parseImplicitMultiplication () {
    let node, last

    node = parseRule2()
    last = node

    while (true) {
      if ((state.tokenType === TOKENTYPE.SYMBOL) ||
          (state.token === 'in' && isConstantNode(node)) ||
          (state.token === 'in' && isOperatorNode(node) && node.fn === 'unaryMinus' && isConstantNode(node.args[0])) ||
          (state.tokenType === TOKENTYPE.NUMBER &&
              !isConstantNode(last) &&
              (!isOperatorNode(last) || last.op === '!')) ||
          (state.token === '(')) {
        // parse implicit multiplication
        //
        // symbol:      implicit multiplication like '2a', '(2+3)a', 'a b'
        // number:      implicit multiplication like '(2+3)2'
        // parenthesis: implicit multiplication like '2(3+4)', '(3+4)(1+2)'
        last = parseRule2()
        node = new OperatorNode('*', 'multiply', [node, last], true /* implicit */)
      } else {
        break
      }
    }

    return node
  }

  /**
   * Infamous "rule 2" as described in https://github.com/josdejong/mathjs/issues/792#issuecomment-361065370
   * And as amended in https://github.com/josdejong/mathjs/issues/2370#issuecomment-1054052164
   * Explicit division gets higher precedence than implicit multiplication
   * when the division matches this pattern:
   *   [unaryPrefixOp]?[number] / [number] [symbol]
   * @return {Node} node
   * @private
   */
  function parseRule2 () {
    let node = parseUnaryPercentage()
    let last = node
    const tokenStates = []

    while (true) {
      // Match the "number /" part of the pattern "number / number symbol"
      if (state.token === '/' && rule2Node(last)) {
        // Look ahead to see if the next token is a number
        tokenStates.push(Object.assign({}, state))
        getTokenSkipNewline()

        // Match the "number / number" part of the pattern
        if (state.tokenType === TOKENTYPE.NUMBER) {
          // Look ahead again
          tokenStates.push(Object.assign({}, state))
          getTokenSkipNewline()

          // Match the "symbol" part of the pattern, or a left parenthesis
          if (state.tokenType === TOKENTYPE.SYMBOL || state.token === '(' || state.token === 'in') {
            // We've matched the pattern "number / number symbol".
            // Rewind once and build the "number / number" node; the symbol will be consumed later
            Object.assign(state, tokenStates.pop())
            tokenStates.pop()
            last = parseUnaryPercentage()
            node = new OperatorNode('/', 'divide', [node, last])
          } else {
            // Not a match, so rewind
            tokenStates.pop()
            Object.assign(state, tokenStates.pop())
            break
          }
        } else {
          // Not a match, so rewind
          Object.assign(state, tokenStates.pop())
          break
        }
      } else {
        break
      }
    }

    return node
  }

  /**
   * Unary percentage operator (treated as `value / 100`)
   * @return {Node} node
   * @private
   */
  function parseUnaryPercentage () {
    let node = parseUnary()

    if (state.token === '%') {
      const previousState = Object.assign({}, state)
      getTokenSkipNewline()
      // We need to decide if this is a unary percentage % or binary modulo %
      // So we attempt to parse a unary expression at this point.
      // If it fails, then the only possibility is that this is a unary percentage.
      // If it succeeds, then we presume that this must be binary modulo, since the
      // only things that parseUnary can handle are _higher_ precedence than unary %.
      try {
        parseUnary()
        // Not sure if we could somehow use the result of that parseUnary? Without
        // further analysis/testing, safer just to discard and let the parse proceed
        Object.assign(state, previousState)
      } catch {
        // Not seeing a term at this point, so was a unary %
        node = new OperatorNode('/', 'divide', [node, new ConstantNode(100)], false, true)
      }
    }

    return node
  }

  /**
   * Unary plus and minus, and logical and bitwise not
   * @return {Node} node
   * @private
   */
  function parseUnary () {
    let name, params, fn
    const operators = {
      '-': 'unaryMinus',
      '+': 'unaryPlus',
      '~': 'bitNot',
      not: 'not'
    }

    if (hasOwnProperty(operators, state.token)) {
      fn = operators[state.token]
      name = state.token

      getTokenSkipNewline()
      params = [parseUnary()]

      return new OperatorNode(name, fn, params)
    }

    return parsePow()
  }

  /**
   * power
   * Note: power operator is right associative
   * @return {Node} node
   * @private
   */
  function parsePow () {
    let node, name, fn, params

    node = parseNullishCoalescing()

    if (state.token === '^' || state.token === '.^') {
      name = state.token
      fn = (name === '^') ? 'pow' : 'dotPow'

      getTokenSkipNewline()
      params = [node, parseUnary()] // Go back to unary, we can have '2^-3'
      node = new OperatorNode(name, fn, params)
    }

    return node
  }

  /**
   * nullish coalescing operator
   * @return {Node} node
   * @private
   */
  function parseNullishCoalescing () {
    let node = parseLeftHandOperators()

    while (state.token === '??') { // eslint-disable-line no-unmodified-loop-condition
      getTokenSkipNewline()
      node = new OperatorNode('??', 'nullish', [node, parseLeftHandOperators()])
    }

    return node
  }

  /**
   * Left hand operators: factorial x!, ctranspose x'
   * @return {Node} node
   * @private
   */
  function parseLeftHandOperators () {
    let node, name, fn, params

    node = parseCustomNodes()

    const operators = {
      '!': 'factorial',
      '\'': 'ctranspose'
    }

    while (hasOwnProperty(operators, state.token)) {
      name = state.token
      fn = operators[name]

      getToken()
      params = [node]

      node = new OperatorNode(name, fn, params)
      node = parseAccessors(node)
    }

    return node
  }

  /**
   * Parse a custom node handler. A node handler can be used to process
   * nodes in a custom way, for example for handling a plot.
   *
   * A handler must be passed as second argument of the parse function.
   * - must extend math.Node
   * - must contain a function _compile(defs: Object) : string
   * - must contain a function find(filter: Object) : Node[]
   * - must contain a function toString() : string
   * - the constructor is called with a single argument containing all parameters
   *
   * For example:
   *
   *     nodes = {
   *       'plot': PlotHandler
   *     }
   *
   * The constructor of the handler is called as:
   *
   *     node = new PlotHandler(params)
   *
   * The handler will be invoked when evaluating an expression like:
   *
   *     node = math.parse('plot(sin(x), x)', nodes)
   *
   * @return {Node} node
   * @private
   */
  function parseCustomNodes () {
    let params = []

    if (state.tokenType === TOKENTYPE.SYMBOL && hasOwnProperty(state.extraNodes, state.token)) {
      const CustomNode = state.extraNodes[state.token]

      getToken()

      // parse parameters
      if (state.token === '(') {
        params = []

        openParams()
        getToken()

        if (state.token !== ')') {
          params.push(parseAssignment())

          // parse a list with parameters
          while (state.token === ',') { // eslint-disable-line no-unmodified-loop-condition
            getToken()
            params.push(parseAssignment())
          }
        }

        if (state.token !== ')') {
          throw createSyntaxError('Parenthesis ) expected')
        }
        closeParams()
        getToken()
      }

      // create a new custom node
      // noinspection JSValidateTypes
      return new CustomNode(params)
    }

    return parseSymbol()
  }

  /**
   * parse symbols: functions, variables, constants, units
   * @return {Node} node
   * @private
   */
  function parseSymbol () {
    let node, name

    if (state.tokenType === TOKENTYPE.SYMBOL ||
        (state.tokenType === TOKENTYPE.DELIMITER && state.token in NAMED_DELIMITERS)) {
      name = state.token

      getToken()

      if (hasOwnProperty(CONSTANTS, name)) { // true, false, null, ...
        node = new ConstantNode(CONSTANTS[name])
      } else if (NUMERIC_CONSTANTS.includes(name)) { // NaN, Infinity
        node = new ConstantNode(numeric(name, 'number'))
      } else {
        node = new SymbolNode(name)
      }

      // parse function parameters and matrix index
      node = parseAccessors(node)
      return node
    }

    return parseString()
  }

  /**
   * parse accessors:
   * - function invocation in round brackets (...), for example sqrt(2) or sqrt?.(2) with optional chaining
   * - index enclosed in square brackets [...], for example A[2,3] or A?.[2,3] with optional chaining
   * - dot notation for properties, like foo.bar or foo?.bar with optional chaining
   * @param {Node} node    Node on which to apply the parameters. If there
   *                       are no parameters in the expression, the node
   *                       itself is returned
   * @param {string[]} [types]  Filter the types of notations
   *                            can be ['(', '[', '.']
   * @return {Node} node
   * @private
   */
  function parseAccessors (node, types) {
    let params

    // Iterate and handle chained accessors, including repeated optional chaining
    while (true) { // eslint-disable-line no-unmodified-loop-condition
      // Track whether an optional chaining operator precedes the next accessor
      let optional = false

      // Consume an optional chaining operator if present
      if (state.token === '?.') {
        optional = true
        // consume the '?.' token
        getToken()
      }

      const hasNextAccessor =
        (state.token === '(' || state.token === '[' || state.token === '.') &&
        (!types || types.includes(state.token))

      if (!(optional || hasNextAccessor)) {
        break
      }

      params = []

      if (state.token === '(') {
        if (optional || isSymbolNode(node) || isAccessorNode(node)) {
          // function invocation: fn(2, 3) or obj.fn(2, 3) or (anything)?.(2, 3)
          openParams()
          getToken()

          if (state.token !== ')') {
            params.push(parseAssignment())

            // parse a list with parameters
            while (state.token === ',') { // eslint-disable-line no-unmodified-loop-condition
              getToken()
              params.push(parseAssignment())
            }
          }

          if (state.token !== ')') {
            throw createSyntaxError('Parenthesis ) expected')
          }
          closeParams()
          getToken()

          node = new FunctionNode(node, params, optional)
        } else {
          // implicit multiplication like (2+3)(4+5) or sqrt(2)(1+2)
          // don't parse it here but let it be handled by parseImplicitMultiplication
          // with correct precedence
          return node
        }
      } else if (state.token === '[') {
        // index notation like variable[2, 3]
        openParams()
        getToken()

        if (state.token !== ']') {
          params.push(parseAssignment())

          // parse a list with parameters
          while (state.token === ',') { // eslint-disable-line no-unmodified-loop-condition
            getToken()
            params.push(parseAssignment())
          }
        }

        if (state.token !== ']') {
          throw createSyntaxError('Parenthesis ] expected')
        }
        closeParams()
        getToken()

        node = new AccessorNode(node, new IndexNode(params), optional)
      } else {
        // dot notation like variable.prop
        // consume the `.` (if it was ?., already consumed):
        if (!optional) getToken()

        const isPropertyName = state.tokenType === TOKENTYPE.SYMBOL ||
          (state.tokenType === TOKENTYPE.DELIMITER && state.token in NAMED_DELIMITERS)
        if (!isPropertyName) {
          let message = 'Property name expected after '
          message += optional ? 'optional chain' : 'dot'
          throw createSyntaxError(message)
        }

        params.push(new ConstantNode(state.token))
        getToken()

        const dotNotation = true
        node = new AccessorNode(node, new IndexNode(params, dotNotation), optional)
      }
    }

    return node
  }

  /**
   * Parse a single or double quoted string.
   * @return {Node} node
   * @private
   */
  function parseString () {
    let node, str

    if (state.token === '"' || state.token === "'") {
      str = parseStringToken(state.token)

      // create constant
      node = new ConstantNode(str)

      // parse index parameters
      node = parseAccessors(node)

      return node
    }

    return parseMatrix()
  }

  /**
   * Parse a string surrounded by single or double quotes
   * @param {"'" | "\""} quote
   * @return {string}
   */
  function parseStringToken (quote) {
    let str = ''

    while (currentCharacter() !== '' && currentCharacter() !== quote) {
      if (currentCharacter() === '\\') {
        next()

        const char = currentCharacter()
        const escapeChar = ESCAPE_CHARACTERS[char]
        if (escapeChar !== undefined) {
          // an escaped control character like \" or \n
          str += escapeChar
          state.index += 1
        } else if (char === 'u') {
          // escaped unicode character
          const unicode = state.expression.slice(state.index + 1, state.index + 5)
          if (/^[0-9A-Fa-f]{4}$/.test(unicode)) { // test whether the string holds four hexadecimal values
            str += String.fromCharCode(parseInt(unicode, 16))
            state.index += 5
          } else {
            throw createSyntaxError(`Invalid unicode character \\u${unicode}`)
          }
        } else {
          throw createSyntaxError(`Bad escape character \\${char}`)
        }
      } else {
        // any regular character
        str += currentCharacter()
        next()
      }
    }

    getToken()
    if (state.token !== quote) {
      throw createSyntaxError(`End of string ${quote} expected`)
    }
    getToken()

    return str
  }

  /**
   * parse the matrix
   * @return {Node} node
   * @private
   */
  function parseMatrix () {
    let array, params, rows, cols

    if (state.token === '[') {
      // matrix [...]
      openParams()
      getToken()

      if (state.token !== ']') {
        // this is a non-empty matrix
        const row = parseRow()

        if (state.token === ';') {
          // 2 dimensional array
          rows = 1
          params = [row]

          // the rows of the matrix are separated by dot-comma's
          while (state.token === ';') { // eslint-disable-line no-unmodified-loop-condition
            getToken()

            if (state.token !== ']') {
              params[rows] = parseRow()
              rows++
            }
          }

          if (state.token !== ']') {
            throw createSyntaxError('End of matrix ] expected')
          }
          closeParams()
          getToken()

          // check if the number of columns matches in all rows
          cols = params[0].items.length
          for (let r = 1; r < rows; r++) {
            if (params[r].items.length !== cols) {
              throw createError('Column dimensions mismatch ' +
                  '(' + params[r].items.length + ' !== ' + cols + ')')
            }
          }

          array = new ArrayNode(params)
        } else {
          // 1 dimensional vector
          if (state.token !== ']') {
            throw createSyntaxError('End of matrix ] expected')
          }
          closeParams()
          getToken()

          array = row
        }
      } else {
        // this is an empty matrix "[ ]"
        closeParams()
        getToken()
        array = new ArrayNode([])
      }

      return parseAccessors(array)
    }

    return parseObject()
  }

  /**
   * Parse a single comma-separated row from a matrix, like 'a, b, c'
   * @return {ArrayNode} node
   */
  function parseRow () {
    const params = [parseAssignment()]
    let len = 1

    while (state.token === ',') { // eslint-disable-line no-unmodified-loop-condition
      getToken()

      // parse expression
      if (state.token !== ']' && state.token !== ';') {
        params[len] = parseAssignment()
        len++
      }
    }

    return new ArrayNode(params)
  }

  /**
   * parse an object, enclosed in angle brackets{...}, for example {value: 2}
   * @return {Node} node
   * @private
   */
  function parseObject () {
    if (state.token === '{') {
      openParams()
      let key

      const properties = {}
      do {
        getToken()

        if (state.token !== '}') {
          // parse key
          if (state.token === '"' || state.token === "'") {
            key = parseStringToken(state.token)
          } else if (state.tokenType === TOKENTYPE.SYMBOL || (state.tokenType === TOKENTYPE.DELIMITER && state.token in NAMED_DELIMITERS)) {
            key = state.token
            getToken()
          } else {
            throw createSyntaxError('Symbol or string expected as object key')
          }

          // parse key/value separator
          if (state.token !== ':') {
            throw createSyntaxError('Colon : expected after object key')
          }
          getToken()

          // parse key
          properties[key] = parseAssignment()
        }
      }
      while (state.token === ',') // eslint-disable-line no-unmodified-loop-condition

      if (state.token !== '}') {
        throw createSyntaxError('Comma , or bracket } expected after object value')
      }
      closeParams()
      getToken()

      let node = new ObjectNode(properties)

      // parse index parameters
      node = parseAccessors(node)

      return node
    }

    return parseNumber()
  }

  /**
   * parse a number
   * @return {Node} node
   * @private
   */
  function parseNumber () {
    let numberStr

    if (state.tokenType === TOKENTYPE.NUMBER) {
      // this is a number
      numberStr = state.token
      getToken()

      const numericType = safeNumberType(numberStr, config)
      const value = numeric(numberStr, numericType)

      return new ConstantNode(value)
    }

    return parseParentheses()
  }

  /**
   * parentheses
   * @return {Node} node
   * @private
   */
  function parseParentheses () {
    let node

    // check if it is a parenthesized expression
    if (state.token === '(') {
      // parentheses (...)
      openParams()
      getToken()

      node = parseAssignment() // start again

      if (state.token !== ')') {
        throw createSyntaxError('Parenthesis ) expected')
      }
      closeParams()
      getToken()

      node = new ParenthesisNode(node)
      node = parseAccessors(node)
      return node
    }

    return parseEnd()
  }

  /**
   * Evaluated when the expression is not yet ended but expected to end
   * @return {Node} res
   * @private
   */
  function parseEnd () {
    if (state.token === '') {
      // syntax error or unexpected end of expression
      throw createSyntaxError('Unexpected end of expression')
    } else {
      throw createSyntaxError('Value expected')
    }
  }

  /**
   * Shortcut for getting the current row value (one based)
   * Returns the line of the currently handled expression
   * @private
   */
  /* TODO: implement keeping track on the row number
  function row () {
    return null
  }
  */

  /**
   * Shortcut for getting the current col value (one based)
   * Returns the column (position) where the last state.token starts
   * @private
   */
  function col () {
    return state.index - state.token.length + 1
  }

  /**
   * Create an error
   * @param {string} message
   * @return {SyntaxError} instantiated error
   * @private
   */
  function createSyntaxError (message) {
    const c = col()
    const error = new SyntaxError(message + ' (char ' + c + ')')
    error.char = c

    return error
  }

  /**
   * Create an error
   * @param {string} message
   * @return {Error} instantiated error
   * @private
   */
  function createError (message) {
    const c = col()
    const error = new SyntaxError(message + ' (char ' + c + ')')
    error.char = c

    return error
  }

  // Now that we can parse, automatically convert strings to Nodes by parsing
  typed.addConversion({ from: 'string', to: 'Node', convert: parse })

  return parse
})
