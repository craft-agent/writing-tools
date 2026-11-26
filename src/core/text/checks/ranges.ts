import { MASK_CHAR } from "../model"
import { CODE_CHAR, DIGITS, LATIN, LINK_CHAR, SENTENCE_MARKS, SPACE } from "./chars"
import type { Occurrence } from "./convention"
import type { LineView } from "./lines"

/** The value of `range_mark` each mark writes; an ASCII tilde is none of them. */
const VALUE_OF: Readonly<Record<string, string>> = {
  "〜": "wave_dash",
  "～": "fullwidth_tilde",
  "-": "hyphen",
  "–": "hyphen",
}

/** The longest unit between a numeral and the mark, in characters. */
const MAX_UNIT = 3

const NUMERAL = `[${DIGITS}]+(?:[.．][${DIGITS}]+)?`

/** One character of a unit: not a space, a digit, a mark, a punctuation mark, a bracket or a placeholder for masked text. */
const UNIT_CHAR = `[^\\s${DIGITS}〜～~\\-–${SENTENCE_MARKS.join("")},.!?！？;；:：…・「」『』（）【】〔〕〈〉《》()\\[\\]*_"'“”‘’${CODE_CHAR}${LINK_CHAR}${MASK_CHAR}]`

/**
 * A numeral, a unit, a mark and, ahead of the match, the numeral after it. The
 * match ends with the mark; the numerals do not start inside another number.
 */
const RANGE = new RegExp(
  `(?<![${DIGITS}])(?<![${DIGITS}][.．])(?<left>${NUMERAL})${UNIT_CHAR}{0,${MAX_UNIT}}${SPACE}*(?<mark>[〜～\\-–])(?=(?<gap>${SPACE}*)(?<right>${NUMERAL}))`,
  "g",
)

const IS_LATIN = new RegExp(LATIN)
const DASH_AFTER_DIGIT = new RegExp(`^[${DIGITS}][-–]$`)
const DASH_BEFORE_DIGIT = new RegExp(`^[-–][${DIGITS}]$`)

/**
 * Whether a hyphen between the numerals at `left` and `rightEnd` joins just
 * those two: no Latin letter touches the pair on the outside, and no other
 * number is joined to it by another hyphen, as in a date or a phone number.
 */
function joinsTwoNumbers(text: string, left: number, rightEnd: number): boolean {
  return (
    !IS_LATIN.test(text[left - 1] ?? "") &&
    !IS_LATIN.test(text[rightEnd] ?? "") &&
    !DASH_AFTER_DIGIT.test(text.slice(Math.max(0, left - 2), left)) &&
    !DASH_BEFORE_DIGIT.test(text.slice(rightEnd, rightEnd + 2))
  )
}

/**
 * Every mark between two numbers, by its kind, spanning the mark. The first
 * number may carry a short unit (`3時〜5時`, `10%-20%`). A hyphen is counted
 * only when it joins exactly two numbers and no Latin letter touches them
 * (see {@link joinsTwoNumbers}), so `2026-11-26` and `x86-64` are not ranges.
 */
export function findRangeMark(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(RANGE)].flatMap((match) => {
      const { gap, right } = match.groups as Record<"gap" | "right", string>
      const at = match.index + match[0].length - 1
      const value = VALUE_OF[text[at]]
      const rightEnd = at + 1 + gap.length + right.length
      if (value === "hyphen" && !joinsTwoNumbers(text, match.index, rightEnd)) return []
      return [{ value, start: start + at, end: start + at + 1 }]
    }),
  )
}
