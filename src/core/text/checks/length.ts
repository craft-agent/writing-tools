import { MASK_CHAR, type Sentence, type TextDocument } from "../model"
import type { RawFinding } from "../rules"

const WHITESPACE = /\s/

/**
 * The length of a text read from the masked text, in code points without
 * whitespace: a masked run (inline code, a URL), which whitespace does not
 * split, counts as one character.
 */
export function compactLength(masked: string): number {
  let length = 0
  let inMask = false
  for (const char of masked) {
    if (char === MASK_CHAR) {
      if (!inMask) length++
      inMask = true
    } else if (WHITESPACE.test(char)) {
      inMask = false
    } else {
      length++
      inMask = false
    }
  }
  return length
}

/**
 * The `long_sentence` findings: each sentence longer than `limit` characters,
 * the terminator and what follows it included, one per sentence and spanning it.
 */
export function findLongSentence(doc: TextDocument, sentences: readonly Sentence[], limit: number): RawFinding[] {
  return sentences.flatMap(({ start, end }) => {
    const length = compactLength(doc.masked.slice(start, end))
    if (length <= limit) return []
    return [
      {
        rule: "long_sentence",
        start,
        end,
        reason: `${length} characters, past ${limit}; a sentence that holds two points may read better as two`,
      },
    ]
  })
}
