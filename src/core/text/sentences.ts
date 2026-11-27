import { MASK_CHAR, TERMINATORS, type Block, type Line, type Sentence, type Terminator } from "./model"

/** The brackets inside which a terminator does not end a sentence and a comma does not end a clause. */
export const OPENING_BRACKETS = new Set([..."「『（("])
export const CLOSING_BRACKETS = new Set([..."」』）)"])
/** What may follow a terminator and still belong to its sentence. */
const TRAILING_CLOSERS = new Set([..."」』）)]】〉》\"'”’"])
const ASCII_LAST = 0x7f
const WHITESPACE = /\s/

function isTerminator(char: string): char is Terminator {
  return (TERMINATORS as readonly string[]).includes(char)
}

/** Whether the terminator at `at` ends its sentence: `!` and `?` do only before a space, the end of the line or a non-ASCII character. */
function endsSentence(masked: string, at: number, stop: number): boolean {
  if (masked[at] !== "!" && masked[at] !== "?") return true
  if (at + 1 >= stop) return true
  const next = masked[at + 1]
  return WHITESPACE.test(next) || next.charCodeAt(0) > ASCII_LAST
}

/** The sentences of one block, read from the masked text; a terminator inside brackets does not end one. */
function sentencesOf(block: Block, masked: string, lines: readonly Line[]): Sentence[] {
  const found: Sentence[] = []
  let start = -1
  let last = -1
  let depth = 0
  for (const number of block.lines) {
    const line = lines[number - 1]
    for (let at = line.contentStart; at < line.contentEnd; at++) {
      const char = masked[at]
      if (char === MASK_CHAR || WHITESPACE.test(char)) continue
      if (start < 0) start = at
      last = at + 1
      if (OPENING_BRACKETS.has(char)) depth++
      else if (CLOSING_BRACKETS.has(char)) depth = Math.max(0, depth - 1)
      else if (depth === 0 && isTerminator(char) && endsSentence(masked, at, line.contentEnd)) {
        let end = at + 1
        while (end < line.contentEnd && TRAILING_CLOSERS.has(masked[end])) end++
        found.push({ start, end, kind: block.kind, terminator: char })
        start = -1
        at = end - 1
      }
    }
  }
  if (start >= 0) found.push({ start, end: last, kind: block.kind, terminator: null })
  return found
}

/**
 * Splits every block into sentences. A soft line break does not end one; a
 * terminator ends it, together with the closing brackets and quotes right after
 * it. A heading is one sentence and a table row has none.
 */
export function splitSentences(masked: string, lines: readonly Line[], blocks: readonly Block[]): Sentence[] {
  const sentences: Sentence[] = []
  for (const block of blocks) {
    if (block.kind === "table") continue
    const found = sentencesOf(block, masked, lines)
    if (block.kind === "heading" && found.length > 1) {
      sentences.push({ ...found[0], end: found[found.length - 1].end, terminator: found[found.length - 1].terminator })
    } else {
      sentences.push(...found)
    }
  }
  return sentences
}
