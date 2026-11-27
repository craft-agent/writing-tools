import type { TextDocument } from "../model"
import type { Genre, RawFinding } from "../rules"
import { findBoldPairs } from "./bold"
import type { LineView } from "./lines"
import { BOLD_PER_THOUSAND, DENSITY_MIN_CHARS, LIST_MIN_LINES, LIST_SHARE } from "./thresholds"

const WHITESPACE = /\s/g
const PERCENT = 100
const PER_THOUSAND = 1000

/** The non-whitespace characters of the lines, a masked unit counting as one. */
export function readableChars(lines: readonly LineView[]): number {
  return lines.reduce((sum, { text }) => sum + [...text.replace(WHITESPACE, "")].length, 0)
}

/**
 * The `bold_density` finding: the bold spans that render, per 1,000
 * characters of readable text, once the text is long enough to judge, spanning
 * the first of them. A pair that does not render is `bold_not_rendered`'s, not
 * counted here.
 */
export function findBoldDensity(doc: TextDocument, lines: readonly LineView[], genre: Genre): RawFinding[] {
  const spans = findBoldPairs(doc, lines).filter(({ opens, closes }) => opens && closes)
  const chars = readableChars(lines)
  const limit = BOLD_PER_THOUSAND[genre]
  const rate = (spans.length / chars) * PER_THOUSAND
  if (chars <= DENSITY_MIN_CHARS || spans.length === 0 || rate <= limit) return []
  const { open, close } = spans[0]
  return [
    {
      rule: "bold_density",
      start: open.start,
      end: close.end,
      reason: `${spans.length} bold spans in ${chars} characters, ${rate.toFixed(2)} per 1,000; more than ${limit} dilutes the emphasis`,
    },
  ]
}

/**
 * The `list_density` finding: the share of the readable lines that are list
 * lines, once the text is long enough to judge, spanning the first list line.
 * Prose, headings, list lines and table rows are the readable lines.
 */
export function findListDensity(lines: readonly LineView[], genre: Genre): RawFinding[] {
  const readable = lines.filter(({ text }) => text.trim() !== "")
  const items = readable.filter(({ kind }) => kind === "list")
  const share = items.length / readable.length
  if (readableChars(readable) <= DENSITY_MIN_CHARS || readable.length < LIST_MIN_LINES) return []
  if (items.length === 0 || share <= LIST_SHARE[genre]) return []
  const { start, text } = items[0]
  return [
    {
      rule: "list_density",
      start,
      end: start + text.length,
      reason: `${items.length} of ${readable.length} lines (${Math.round(share * PERCENT)}%) are list items; more than ${Math.round(LIST_SHARE[genre] * PERCENT)}% reads as notes, not as text`,
    },
  ]
}
