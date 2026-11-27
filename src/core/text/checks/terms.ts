import { locate } from "../document"
import { leadOf } from "../excerpt"
import type { TextDocument } from "../model"
import type { CheckSpec } from "../rules"
import type { Term } from "../schemas"
import { readableLines } from "./lines"

/**
 * The patterns of the `terms` inventory, as the package's own data. Terms are
 * found by their characters: a Latin word is a run of letters, digits and
 * underscores in either width, and a katakana word a run of katakana, the long
 * vowel mark included, in either width. A run is judged whole, so the OS in
 * `iOS` and the data in データベース are no terms of their own.
 */

/** The fewest characters, after NFKC, of a katakana run that is a term. */
const MIN_KATAKANA_LENGTH = 3

/** A run of ASCII or fullwidth letters, digits and underscores. */
const LATIN_RUN = "[A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]+"

/** A katakana run starts with a letter, never with ー, and ends where a character outside the class, ・ among them, stands. Halfwidth marks ﾞ ﾟ ｰ may follow. */
const KATAKANA_RUN = "[\\u30A1-\\u30FA\\uFF66-\\uFF6F\\uFF71-\\uFF9D][\\u30A1-\\u30FA\\u30FC-\\u30FF\\uFF66-\\uFF9F]*"

/** Where a term can start: a Latin run or a katakana run. */
const CANDIDATE = new RegExp(`(?<latin>${LATIN_RUN})|(?<katakana>${KATAKANA_RUN})`, "g")

/** Two or more capitals, then digits, as `API` and `HTTP2`. */
const ACRONYM = /^[A-Z]{2,}[0-9]*$/

/** A name that starts with a letter and mixes upper and lower case, as `GitHub`, `macOS`, `iPhone`, `Linux` and `Python`. */
const MIXED_CASE = /^(?=.*[a-z])(?=.*[A-Z])[A-Za-z][A-Za-z0-9]*$/

/** An uppercase letter after the first character: a mixed-case word with one is a name wherever it stands, `GitHub` and `iOS` but not `Linux`. */
const INNER_CAPITAL = /^.[A-Za-z0-9]*[A-Z]/

/** The letters of a Latin run, in either width; a run of digits alone is no word. */
const LETTER = /[A-Za-zＡ-Ｚａ-ｚ]/

/** What may stand between two Latin words for them to be neighbours: spaces and nothing else, so a hyphen or a dot sets them apart. */
const SPACES_ONLY = /^ +$/

/** The closing ー that `サーバ` and `サーバー` differ by. */
const CLOSING_LONG_VOWEL = /ー$/

/** What directly after a use says the term is being defined, as `APIとは`. */
const GLOSS_MARKERS = ["とは", "と呼ぶ", "と呼ばれる", "という"] as const

/** A bracket after an optional space opens a gloss: `API（…）` and `API (…)`. */
const GLOSS_OPENING = /[ \u3000]*[（(]/y

const OPENING_BRACKETS = "（("
const CLOSING_BRACKETS = "）)"
const WHITESPACE = /\s/

/** A term of the inventory as it is being counted. */
type Entry = {
  kind: Term["kind"]
  /** Each form as written, with its count, in order of first use. */
  forms: Map<string, number>
  count: number
  /** The offset of the first use in the text. */
  first: number
  glossed: boolean
}

/** What a candidate run is, and the key that makes its forms one term; `undefined` when it is no term. `alone` marks a name that counts only when no other Latin word is beside it. */
type Classified = { kind: Term["kind"]; key: string; alone?: true }

function classify(match: RegExpExecArray): Classified | undefined {
  const normalized = match[0].normalize("NFKC")
  if (match.groups?.katakana !== undefined) {
    if ([...normalized].length < MIN_KATAKANA_LENGTH) return undefined
    return { kind: "katakana", key: normalized.replace(CLOSING_LONG_VOWEL, "") }
  }
  if (ACRONYM.test(normalized)) return { kind: "acronym", key: normalized }
  if (!MIXED_CASE.test(normalized)) return undefined
  return INNER_CAPITAL.test(normalized)
    ? { kind: "latin", key: normalized }
    : { kind: "latin", key: normalized, alone: true }
}

/** Whether two candidates in a row are Latin words with spaces alone between them. */
function areNeighbours(text: string, left: RegExpExecArray, right: RegExpExecArray): boolean {
  return (
    left.groups?.latin !== undefined &&
    right.groups?.latin !== undefined &&
    LETTER.test(left[0]) &&
    LETTER.test(right[0]) &&
    SPACES_ONLY.test(text.slice(left.index + left[0].length, right.index))
  )
}

/** Whether the candidate at `at` has a Latin word beside it across spaces, as in an English phrase. */
function hasLatinNeighbour(text: string, matches: readonly RegExpExecArray[], at: number): boolean {
  const before = matches[at - 1]
  const after = matches[at + 1]
  return (
    (before !== undefined && areNeighbours(text, before, matches[at])) ||
    (after !== undefined && areNeighbours(text, matches[at], after))
  )
}

/** Whether the use at `[start, end)` of the line `view` is followed by a gloss or sits in brackets after other text. */
function isGlossed(view: string, start: number, end: number): boolean {
  if (GLOSS_MARKERS.some((marker) => view.startsWith(marker, end))) return true
  GLOSS_OPENING.lastIndex = end
  if (GLOSS_OPENING.test(view)) return true
  const before = view[start - 1]
  const after = view[end]
  const lead = view[start - 2]
  return (
    before !== undefined &&
    OPENING_BRACKETS.includes(before) &&
    after !== undefined &&
    CLOSING_BRACKETS.includes(after) &&
    lead !== undefined &&
    !WHITESPACE.test(lead)
  )
}

/** The most used form, the first used on a tie. */
function commonForm(forms: ReadonlyMap<string, number>): string {
  let best = ""
  let most = 0
  for (const [form, count] of forms) {
    if (count > most) {
      best = form
      most = count
    }
  }
  return best
}

function termOf(doc: TextDocument, entry: Entry): Term {
  const { line, column } = locate(doc, entry.first)
  return {
    term: leadOf(commonForm(entry.forms)),
    kind: entry.kind,
    count: entry.count,
    ...(entry.forms.size > 1 && {
      forms: [...entry.forms].map(([form, count]) => ({ form: leadOf(form), count })),
    }),
    line,
    column,
    glossed: entry.glossed,
  }
}

/**
 * Every acronym, Latin name and katakana word of the prose, list items,
 * headings and table rows, in order of first use. A Latin word with an
 * uppercase letter after its first character (`GitHub`, `iOS`) is a name
 * wherever it stands; one that is only Capitalized (`Linux`, `Application`) is
 * a name only when no other Latin word is beside it across spaces, so
 * `Python で書く` lists `Python` while an English phrase is not listed word by
 * word. Forms that differ by width or a closing ー are one term; quotations
 * and masked text are never read.
 */
export function termsOf(doc: TextDocument): Term[] {
  const entries = new Map<string, Entry>()
  for (const { start, text } of readableLines(doc)) {
    const matches = [...text.matchAll(CANDIDATE)]
    for (const [at, match] of matches.entries()) {
      const found = classify(match)
      if (found === undefined || (found.alone && hasLatinNeighbour(text, matches, at))) continue
      const form = match[0]
      const end = match.index + form.length
      const entry = entries.get(found.key) ?? {
        kind: found.kind,
        forms: new Map<string, number>(),
        count: 0,
        first: start + match.index,
        glossed: false,
      }
      entry.count++
      entry.forms.set(form, (entry.forms.get(form) ?? 0) + 1)
      entry.glossed ||= isGlossed(text, match.index, end)
      entries.set(found.key, entry)
    }
  }
  return [...entries.values()].map((entry) => termOf(doc, entry))
}

/**
 * An inventory with no rules and no finding: the acronyms, Latin names and
 * katakana words, each with its forms, its count and whether a use is glossed.
 * It reads characters, not tokens, so it needs no engine.
 */
export const termsCheck: CheckSpec = {
  name: "terms",
  rules: [],
  run: ({ doc }) => ({ findings: [], terms: termsOf(doc) }),
}
