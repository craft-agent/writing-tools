import { MASK_CHAR, type TextDocument } from "../model"
import type { RawFinding } from "../rules"
import type { LineView } from "./lines"

/** A character beside a delimiter run, or `undefined` at the edge of the line, which CommonMark treats as whitespace. */
type Neighbour = string | undefined

/** Where a `**` run sits in the text, and the characters beside it. */
type Delimiter = { start: number; end: number; before: Neighbour; after: Neighbour }

/** A pair of `**` runs on one line, and whether each can open or close emphasis under CommonMark's flanking rules. */
export type BoldPair = { open: Delimiter; close: Delimiter; opens: boolean; closes: boolean }

const STARS = /\*+/g
const DELIMITER_LENGTH = 2
const BACKSLASH = "\\"
/** Unicode whitespace as CommonMark defines it: the Zs category, tab, line feed, form feed and carriage return. */
const WHITESPACE = /^[\p{Zs}\t\n\f\r]$/u
/** Unicode punctuation as CommonMark 0.31 defines it: the P and S categories. */
const PUNCTUATION = /^[\p{P}\p{S}]$/u

function isWhitespace(char: Neighbour): boolean {
  return char === undefined || WHITESPACE.test(char)
}

function isPunctuation(char: Neighbour): boolean {
  return char !== undefined && PUNCTUATION.test(char)
}

/** A left-flanking run can open emphasis. */
function isLeftFlanking({ before, after }: Delimiter): boolean {
  return !isWhitespace(after) && (!isPunctuation(after) || isWhitespace(before) || isPunctuation(before))
}

/** A right-flanking run can close emphasis. */
function isRightFlanking({ before, after }: Delimiter): boolean {
  return !isWhitespace(before) && (!isPunctuation(before) || isWhitespace(after) || isPunctuation(after))
}

/** The `**` runs of a line, outside masked text. A `*` that a backslash escapes is no part of a run. */
function delimitersOf(doc: TextDocument, { start, text }: LineView): Delimiter[] {
  const floor = start
  const ceil = start + text.length
  return [...text.matchAll(STARS)].flatMap((run) => {
    const escaped = run.index > 0 && text[run.index - 1] === MASK_CHAR && doc.text[start + run.index - 1] === BACKSLASH
    const from = start + run.index + (escaped ? 1 : 0)
    const to = start + run.index + run[0].length
    if (to - from !== DELIMITER_LENGTH) return []
    return [
      {
        start: from,
        end: to,
        before: Array.from(doc.text.slice(Math.max(floor, from - 2), from)).pop(),
        after: Array.from(doc.text.slice(to, Math.min(ceil, to + 2)))[0],
      },
    ]
  })
}

/**
 * The `**` pairs of the lines, each line's runs paired in order, so a run
 * left over at the end of a line has no partner. A character beside a run is
 * read from the text itself, so inline code, an escape and an HTML tag count
 * as the characters they are.
 */
export function findBoldPairs(doc: TextDocument, lines: readonly LineView[]): BoldPair[] {
  return lines.flatMap((line) => {
    const delimiters = delimitersOf(doc, line)
    const pairs: BoldPair[] = []
    for (let at = 0; at + 1 < delimiters.length; at += 2) {
      const [open, close] = [delimiters[at], delimiters[at + 1]]
      pairs.push({ open, close, opens: isLeftFlanking(open), closes: isRightFlanking(close) })
    }
    return pairs
  })
}

/** What a character is, in words: itself in quotes, a space, or the edge of the line. */
function describe(char: Neighbour): string {
  if (char === undefined) return "the edge of the line"
  return isWhitespace(char) ? "a space" : `"${char}"`
}

function openingFault({ before, after }: Delimiter): string {
  if (isWhitespace(after)) {
    return "the opening ** is followed by a space or the end of the line, so it does not open bold; remove the space"
  }
  return `the opening ** follows ${describe(before)} and precedes ${describe(after)}, so it does not open bold; move ${describe(after)} outside the bold, or put a space before **`
}

function closingFault({ before, after }: Delimiter): string {
  if (isWhitespace(before)) {
    return "the closing ** is preceded by a space or the start of the line, so it does not close bold; remove the space"
  }
  return `the closing ** follows ${describe(before)} and precedes ${describe(after)}, so it does not close bold; move ${describe(before)} outside the bold, or put a space after **`
}

/** Each pair that CommonMark would not render as strong emphasis, over both runs, with what to move. */
export function findBoldNotRendered(doc: TextDocument, lines: readonly LineView[]): RawFinding[] {
  return findBoldPairs(doc, lines).flatMap(({ open, close, opens, closes }) => {
    if (opens && closes) return []
    const faults = [...(opens ? [] : [openingFault(open)]), ...(closes ? [] : [closingFault(close)])]
    return [{ rule: "bold_not_rendered", start: open.start, end: close.end, reason: faults.join("; ") }]
  })
}
