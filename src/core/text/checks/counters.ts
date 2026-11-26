import { DIGITS } from "./chars"
import { occurrenceOf, type Occurrence } from "./convention"
import type { LineView } from "./lines"

/** The value of `counter_ka` each character that reads か writes. */
const VALUE_OF: Readonly<Record<string, string>> = {
  か: "hiragana",
  ヶ: "small_ke",
  ケ: "small_ke",
  カ: "katakana",
  ヵ: "katakana",
}

/** The numerals a counter follows besides digits, and the nouns that take the か. */
const NUMERALS = "一二三四五六七八九十百千何数幾"
const COUNTER_NOUNS = "月所国条年"

const COUNTER_KA = new RegExp(
  `(?<=[${DIGITS}${NUMERALS}])([${Object.keys(VALUE_OF).join("")}])(?=[${COUNTER_NOUNS}])`,
  "g",
)

/**
 * Every か, ヶ, ケ, カ or ヵ between a numeral and a counter noun (`3か月`,
 * `三ヶ所`, `何カ国`), by how it is written, spanning that one character. A
 * ケ that stands for 個 (`3ケ`) has no such noun after it.
 */
export function findCounterKa(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(COUNTER_KA)].map((match) => occurrenceOf(VALUE_OF[match[0]], start, match)),
  )
}
