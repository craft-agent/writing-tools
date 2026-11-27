import type { TextDocument } from "../model"
import type { RawFinding, Stance } from "../rules"
import { COUNTED_KINDS, stripTrailing, terminatedSentences } from "./register"

/** What a sentence ending does: it recommends, requests, judges or tells the reader to act. */
export type EndingKind = "recommendation" | "request" | "evaluation" | "action"

/** A sentence's ending: what it does, the ending's text, and where it starts in the text that was classified. */
export type StanceEnding = { kind: EndingKind; ending: string; index: number }

/** The words a polite evaluation is made of, with the endings that turn them into a judgement. */
const EVALUATIVE_WORDS = ["重要", "大切", "大事", "不可欠", "必要"]
const COPULAS = ["です", "だ", "である"]

/** The fixed endings of each kind, as the package's own lists; `action` has none, since any polite verb can be one. */
const ENDINGS: Record<Exclude<EndingKind, "action">, readonly string[]> = {
  request: ["ください", "下さい", "てください", "してほしい", "お願いします"],
  recommendation: [
    "ましょう",
    "とよいでしょう",
    "とよいです",
    "といいです",
    "をおすすめします",
    "をお勧めします",
    "ことをおすすめします",
    "べきです",
    "べきだ",
  ],
  evaluation: [...EVALUATIVE_WORDS.flatMap((word) => COPULAS.map((copula) => word + copula)), "欠かせません"],
}

/** The kinds in the order they are tried. */
const FIXED_KINDS = ["request", "recommendation", "evaluation"] as const

const POLITE_VERB = "ます"
/** The characters of a polite verb's ending that `action` reports: the last of the stem and `ます`, as in `します`. */
const ACTION_ENDING_LENGTH = 3
/** What stands before `ます` in a verb that does not tell the reader to act: a passive, a progressive, or ある, なる, できる, いる. */
const NOT_AN_ACTION = /(?:れ|[てで]い|あり|なり|でき|[がにもは]い)$/

/**
 * What the wording ends in, from the text before the sentence's terminator,
 * or `undefined` when it ends in none of the kinds. A fixed ending is tried
 * kind by kind and the longest match of a kind wins; a polite verb ending in
 * `ます` is an action unless it is passive (`れます`, `られます`), progressive
 * (`ています`) or a state (`あります`, `なります`, `できます`, `います`).
 * `index` is where the matched ending starts in `body`.
 */
export function classifyStanceEnding(body: string): StanceEnding | undefined {
  const text = stripTrailing(body)
  for (const kind of FIXED_KINDS) {
    const matches = ENDINGS[kind].filter((ending) => text.endsWith(ending)).sort((a, b) => b.length - a.length)
    if (matches.length > 0) return { kind, ending: matches[0], index: text.length - matches[0].length }
  }
  if (!text.endsWith(POLITE_VERB)) return undefined
  const stem = text.slice(0, -POLITE_VERB.length)
  if (stem === "" || NOT_AN_ACTION.test(stem)) return undefined
  const index = text.length - ACTION_ENDING_LENGTH
  return { kind: "action", ending: text.slice(index), index }
}

/** The kinds of ending that go against each stance. */
export const CONFLICTS: Record<Stance, readonly EndingKind[]> = {
  advice: ["action"],
  rule: ["recommendation", "evaluation"],
  explanation: ["recommendation", "request"],
}

export const KIND_NOUNS: Record<EndingKind, string> = {
  recommendation: "a recommendation",
  request: "a request",
  evaluation: "an evaluation",
  action: "an action",
}

export const STANCE_NOUNS: Record<Stance, string> = {
  advice: "advice",
  rule: "a rule",
  explanation: "an explanation",
}

/**
 * The `stance_ending` findings: each sentence of body text and list items
 * whose ending goes against the stance, spanning the ending through the
 * terminator. An explanation may close with a request or a recommendation, so
 * the last sentence of the text is spared there.
 */
export function findStanceEnding(doc: TextDocument, stance: Stance): RawFinding[] {
  const sentences = terminatedSentences(doc, COUNTED_KINDS)
  return sentences.flatMap(({ text, offsets, terminatorAt }, order) => {
    const found = classifyStanceEnding(text.slice(0, terminatorAt))
    if (found === undefined || !CONFLICTS[stance].includes(found.kind)) return []
    if (stance === "explanation" && order === sentences.length - 1) return []
    return [
      {
        rule: "stance_ending",
        start: offsets[found.index],
        end: offsets[terminatorAt] + 1,
        reason: `${KIND_NOUNS[found.kind]} in ${STANCE_NOUNS[stance]}: the sentence ends in "${found.ending}"`,
      },
    ]
  })
}
