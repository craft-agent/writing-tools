import type { RawFinding } from "../rules"
import { KATAKANA } from "./chars"
import type { LineView } from "./lines"

/** One kanji or katakana character, the end of a noun in a pattern. */
export const NOUN_CHAR = `(?:\\p{Script=Han}|${KATAKANA})`

/**
 * Two such characters just before the match: a word that takes `する` as its
 * own verb. A single kanji before it is often a verb in itself (`愛する`
 * becomes `愛せる`, not `愛できる`), so it does not count.
 */
export const AFTER_SURU_NOUN = `(?<=${NOUN_CHAR}{2})`

/** The flags every pattern of the lists is compiled with: global, to find each one, and Unicode, for `\p{…}` and lookbehind. */
const FLAGS = "gu"

/** A phrase of a list: its pattern as a regular expression source, and a text it must match, which the tests hold the list to. */
export type Phrase = { pattern: string; sample: string }

/** The wording that replaces a match: fixed, or read from the match (a captured noun, the ending that follows). */
export type Shorter = string | ((match: RegExpExecArray) => string)

/**
 * A phrase with a shorter wording that says the same, `""` when it can go.
 * `note` replaces the default reason when the shorter wording depends on a
 * word the pattern does not capture; `shorter` is then `""`.
 */
export type Rewrite = Phrase & { shorter: Shorter; note?: string }

/** A match in the document: where it is in `doc.text`, and the match itself. */
export type Hit = { start: number; end: number; match: RegExpExecArray }

/** The pattern of a list entry, ready to search a line with. */
export function compile(pattern: string): RegExp {
  return new RegExp(pattern, FLAGS)
}

/** Every match of a pattern in the lines, in the order of the lines. A line is searched alone, so a match never crosses a line break. */
export function matchesIn(lines: readonly LineView[], pattern: RegExp): Hit[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(pattern)].map((match) => ({
      start: start + match.index,
      end: start + match.index + match[0].length,
      match,
    })),
  )
}

/** The wording that replaces what a pattern of the list matched. */
export function shorterOf({ shorter }: Rewrite, match: RegExpExecArray): string {
  return typeof shorter === "function" ? shorter(match) : shorter
}

function reasonOf(entry: Rewrite, match: RegExpExecArray): string {
  const [found] = match
  if (entry.note !== undefined) return `"${found}": ${entry.note}`
  const shorter = shorterOf(entry, match)
  return shorter === "" ? `"${found}" can go` : `"${found}": "${shorter}" says the same`
}

/** One finding per match of each entry, spanning the matched phrase, with the shorter wording as its reason. */
export function findRewrites(lines: readonly LineView[], rule: string, entries: readonly Rewrite[]): RawFinding[] {
  return entries.flatMap((entry) =>
    matchesIn(lines, compile(entry.pattern)).map(({ start, end, match }) => ({
      rule,
      start,
      end,
      reason: reasonOf(entry, match),
    })),
  )
}

/** One finding per match of each entry, spanning the matched phrase, all with the same reason. */
export function findWords(
  lines: readonly LineView[],
  rule: string,
  entries: readonly Phrase[],
  reason: string,
): RawFinding[] {
  return entries.flatMap(({ pattern }) =>
    matchesIn(lines, compile(pattern)).map(({ start, end }) => ({ rule, start, end, reason })),
  )
}
