import type { RawFinding } from "../rules"
import {
  CLOSING_BRACKETS,
  HAS_JAPANESE,
  JAPANESE,
  LATIN,
  OPENING_BRACKETS,
  SENTENCE_MARKS,
  SPACE,
  TRANSPARENT,
  UNITS,
} from "./chars"
import type { Occurrence } from "./convention"
import type { LineView } from "./lines"

/** What may lie between a Japanese character and a Latin word: unseen markers, and ASCII spaces with markers around them. */
const GAP = `(${TRANSPARENT}*)(?:( +)(${TRANSPARENT}*))?`

/** At each Japanese character that a Latin word follows, and at each Latin character that a Japanese one follows. */
const BOUNDARIES = [`(?=(${JAPANESE})${GAP}(${LATIN}))`, `(?=(${LATIN})${GAP}(${JAPANESE}))`].map(
  (source) => new RegExp(source, "g"),
)

const NUMERAL_UNIT = new RegExp(
  `(?<![A-Za-z0-9._\\-])(?<!\\d,)(\\d+(?:[.,]\\d+)*)( *)(${UNITS.join("|")})(?![A-Za-z0-9])`,
  "g",
)

const SPACE_RUN = new RegExp(`${SPACE}+`, "g")

const MARKS = SENTENCE_MARKS.join("")

/** Whether `char` is one of `set`'s characters; a missing character is none. */
function isIn(set: string, char: string | undefined): boolean {
  return char !== undefined && set.includes(char)
}

/** The word a reason uses for a run of spaces. */
function spaceWord(run: string): string {
  return run.includes("\u3000") ? "ideographic space" : "space"
}

/**
 * Every boundary between a Japanese character and a Latin word or inline
 * code, as `spaced` when ASCII spaces lie between them and `unspaced` when
 * nothing but emphasis markers and link brackets does. A spaced boundary
 * spans its spaces; an unspaced one spans the two characters and what is
 * between them. A Latin word is a run of letters, so digits alone are not one.
 */
export function findLatinSpacing(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    BOUNDARIES.flatMap((boundary) =>
      [...text.matchAll(boundary)].map((match): Occurrence => {
        const [, , before, spaces = "", after = ""] = match
        const gapStart = match.index + 1 + before.length
        const offset = start + gapStart
        if (spaces.length > 0) return { value: "spaced", start: offset, end: offset + spaces.length }
        return { value: "unspaced", start: start + match.index, end: offset + after.length + 1 }
      }),
    ),
  )
}

/**
 * Every numeral that a unit from {@link UNITS} follows, as `spaced` or
 * `unspaced`. A numeral that follows a letter, digit, `.`, `_` or `-` is part
 * of something else (`v1.2`, `x86`), and a unit that a letter or digit follows
 * is a longer word.
 */
export function findUnitSpacing(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(NUMERAL_UNIT)].map((match): Occurrence => {
      const [, numeral, spaces] = match
      const numeralEnd = start + match.index + numeral.length
      if (spaces.length > 0) return { value: "spaced", start: numeralEnd, end: numeralEnd + spaces.length }
      return { value: "unspaced", start: numeralEnd - 1, end: numeralEnd + 1 }
    }),
  )
}

/** One run of spaces with the characters beside it on its line; `undefined` where the line ends. */
type SpaceRun = { start: number; end: number; run: string; previous: string | undefined; next: string | undefined }

function spaceRuns(lines: readonly LineView[]): SpaceRun[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(SPACE_RUN)].map((match) => {
      const end = match.index + match[0].length
      return {
        start: start + match.index,
        end: start + end,
        run: match[0],
        previous: text[match.index - 1],
        next: text[end],
      }
    }),
  )
}

function finding(rule: string, { start, end }: SpaceRun, reason: string): RawFinding {
  return { rule, start, end, reason }
}

/** Spaces between two Japanese characters; an indent is not between. */
export function findSpaceBetweenJapanese(lines: readonly LineView[]): RawFinding[] {
  return spaceRuns(lines)
    .filter(({ previous, next }) => [previous, next].every((char) => char !== undefined && HAS_JAPANESE.test(char)))
    .map((run) => finding("space_between_japanese", run, `${spaceWord(run.run)} between Japanese characters`))
}

/** Spaces right before 、。，． or right after one that more text follows; trailing spaces are a hard break, not text. */
export function findSpaceAroundPunctuation(lines: readonly LineView[]): RawFinding[] {
  return spaceRuns(lines).flatMap((run) => {
    const word = spaceWord(run.run)
    if (isIn(MARKS, run.next)) return [finding("space_around_punctuation", run, `${word} before punctuation`)]
    if (isIn(MARKS, run.previous) && run.next !== undefined)
      return [finding("space_around_punctuation", run, `${word} after punctuation`)]
    return []
  })
}

/** Spaces right after an opening bracket that more text follows, or right before a closing one. */
export function findSpaceInsideBrackets(lines: readonly LineView[]): RawFinding[] {
  return spaceRuns(lines).flatMap((run) => {
    const word = spaceWord(run.run)
    if (isIn(CLOSING_BRACKETS, run.next))
      return [finding("space_inside_brackets", run, `${word} before a closing bracket`)]
    if (isIn(OPENING_BRACKETS, run.previous) && run.next !== undefined)
      return [finding("space_inside_brackets", run, `${word} after an opening bracket`)]
    return []
  })
}
