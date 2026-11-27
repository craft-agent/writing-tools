import type { RawFinding } from "../rules"
import {
  FULLWIDTH_ALNUM_RUN,
  HALFWIDTH_ALNUM_RUN,
  HALFWIDTH_KATAKANA_RUN,
  HAS_JAPANESE,
  IS_SPACE,
  IS_TRANSPARENT,
} from "./chars"
import { occurrenceOf, type Occurrence } from "./convention"
import type { LineView } from "./lines"

/** How many characters beside a halfwidth run are searched for Japanese text; spaces and markers are not counted. */
const NEIGHBOURHOOD = 2

/** The longest run of characters a reason quotes; a longer one is cut. */
const MAX_QUOTED = 20

const FULLWIDTH_PAIR = /（([^（）()]*)）/g
const HALFWIDTH_PAIR = /\(([^()（）]*)\)/g

/** Whether a Japanese character lies within {@link NEIGHBOURHOOD} characters of `from`, stepping by `step`. */
function japaneseNear(text: string, from: number, step: 1 | -1): boolean {
  let seen = 0
  for (let at = from; at >= 0 && at < text.length && seen < NEIGHBOURHOOD; at += step) {
    const char = text[at]
    if (IS_SPACE.test(char) || IS_TRANSPARENT.test(char)) continue
    if (HAS_JAPANESE.test(char)) return true
    seen++
  }
  return false
}

function quoted(value: string): string {
  return value.length > MAX_QUOTED ? `${value.slice(0, MAX_QUOTED)}…` : value
}

/**
 * Every run of fullwidth letters and digits, and every run of ASCII letters
 * and digits that touches or sits within Japanese text, so an English
 * sentence or a code-like token far from Japanese is not counted. Inline code
 * is never read.
 */
export function findAlnumWidth(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) => {
    const fullwidth = [...text.matchAll(FULLWIDTH_ALNUM_RUN)].map((match) => occurrenceOf("fullwidth", start, match))
    const halfwidth = [...text.matchAll(HALFWIDTH_ALNUM_RUN)]
      .filter((match) => {
        return japaneseNear(text, match.index - 1, -1) || japaneseNear(text, match.index + match[0].length, 1)
      })
      .map((match) => occurrenceOf("halfwidth", start, match))
    return [...fullwidth, ...halfwidth]
  })
}

/** Every pair of parentheses with no other parenthesis inside and a Japanese character within, by its width. */
export function findBracketWidth(lines: readonly LineView[]): Occurrence[] {
  const pairs = [
    { value: "fullwidth", pair: FULLWIDTH_PAIR },
    { value: "halfwidth", pair: HALFWIDTH_PAIR },
  ]
  return lines.flatMap(({ start, text }) =>
    pairs.flatMap(({ value, pair }) =>
      [...text.matchAll(pair)]
        .filter((match) => HAS_JAPANESE.test(match[1]))
        .map((match) => occurrenceOf(value, start, match)),
    ),
  )
}

/** Each run of halfwidth katakana, with the fullwidth form that normalization gives. */
export function findHalfwidthKatakana(lines: readonly LineView[]): RawFinding[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(HALFWIDTH_KATAKANA_RUN)].map((match) => {
      const { start: from, end } = occurrenceOf("", start, match)
      const reason = `halfwidth katakana "${quoted(match[0])}"; the fullwidth form is "${quoted(match[0].normalize("NFKC"))}"`
      return { rule: "halfwidth_katakana", start: from, end, reason }
    }),
  )
}
