import type { TextDocument } from "../model"
import type { Genre, RawFinding } from "../rules"
import type { LineView } from "./lines"
import { compile, matchesIn } from "./phrases"
import { COUNTED_KINDS, terminatedSentences } from "./register"
import { CONTRAST_MIN_COUNT, CONTRAST_PER_SENTENCE } from "./thresholds"

/**
 * The contrast constructions `contrast_overuse` counts, as the package's own
 * pattern: `ではなく`, `だけでなく` with a `も` later in the sentence,
 * `わけではない`, and `というより`.
 */
const CONTRAST = compile("ではなく|だけでなく(?=[^。！？!?]{0,30}も)|わけでは(?:ない|ありません)|というより(?:は|も)?")

/**
 * The `contrast_overuse` finding: the contrast constructions of the readable
 * lines, once there are enough of them and they are as many per counted
 * sentence as the genre allows, spanning the first.
 */
export function findContrastOveruse(doc: TextDocument, lines: readonly LineView[], genre: Genre): RawFinding[] {
  const hits = matchesIn(lines, CONTRAST)
  const sentences = terminatedSentences(doc, COUNTED_KINDS).length
  if (hits.length < CONTRAST_MIN_COUNT || sentences === 0) return []
  const rate = hits.length / sentences
  const limit = CONTRAST_PER_SENTENCE[genre]
  if (rate < limit) return []
  const { start, end } = hits[0]
  return [
    {
      rule: "contrast_overuse",
      start,
      end,
      reason: `${hits.length} contrast constructions in ${sentences} sentences, ${rate.toFixed(2)} per sentence; ${limit} or more reads as a habit`,
    },
  ]
}
