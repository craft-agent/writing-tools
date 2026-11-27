import type { Sentence, TextDocument } from "../model"
import type { CheckContext, CheckSpec, RawFinding, RuleSpec } from "../rules"
import { findCommaRun } from "./commas"
import { findKanjiRun } from "./kanji"
import { findLongSentence } from "./length"
import { COUNTED_KINDS } from "./register"

/** A rule at `info` that is on by default and needs no morphology, explained in `readability.md` under its id. */
function rule(id: string): RuleSpec {
  return {
    id,
    check: "readability",
    severity: "info",
    defaultOn: true,
    morphology: false,
    reference: `readability.md#${id}`,
  }
}

/** The sentences of body text and list items, with or without a terminator; headings, tables and quotations are not read. */
function readableSentences(doc: TextDocument): Sentence[] {
  return doc.sentences.filter(({ kind }) => COUNTED_KINDS.has(kind))
}

/** A rule that reports findings: its spec, and where it finds them. */
type FindingRule = { spec: RuleSpec; find(ctx: CheckContext): RawFinding[] }

const FINDING_RULES: readonly FindingRule[] = [
  {
    spec: rule("long_sentence"),
    find: ({ doc, thresholds }) => findLongSentence(doc, readableSentences(doc), thresholds.sentence_length),
  },
  {
    spec: rule("kanji_run"),
    find: ({ doc, thresholds }) => findKanjiRun(doc, readableSentences(doc), thresholds.kanji_run),
  },
  {
    spec: rule("comma_run"),
    find: ({ doc }) => findCommaRun(doc, readableSentences(doc)),
  },
]

/**
 * How easily the text reads: sentences past the length the thresholds allow,
 * runs of kanji, and short clauses in a row. They are patterns the writer
 * weighs, so every rule reports at `info`. The thresholds come from the
 * settings, else from the genre.
 */
export const readabilityCheck: CheckSpec = {
  name: "readability",
  rules: FINDING_RULES.map(({ spec }) => spec),
  run(ctx) {
    return { findings: FINDING_RULES.filter(({ spec }) => ctx.enabled(spec.id)).flatMap(({ find }) => find(ctx)) }
  },
}
