import { HAS_JAPANESE } from "./chars"
import { occurrenceOf, type Occurrence } from "./convention"
import type { LineView } from "./lines"

/**
 * The pairs of marks that quote text, with the value of `quotes` each one
 * writes. A pair holds no mark of its own kind, so nested or unbalanced marks
 * of a kind never pair; ASCII marks pair in the order they come. `『』` is not
 * listed: it marks a nested quotation or a title.
 */
const PAIRS = [
  { value: "corner", pair: /「([^「」]*)」/g },
  { value: "double", pair: /“([^“”]*)”/g },
  { value: "double", pair: /"([^"]*)"/g },
]

/** Every pair on one line that encloses a Japanese character, by its kind, spanning the pair. */
export function findQuotes(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    PAIRS.flatMap(({ value, pair }) =>
      [...text.matchAll(pair)]
        .filter((match) => HAS_JAPANESE.test(match[1]))
        .map((match) => occurrenceOf(value, start, match)),
    ),
  )
}
