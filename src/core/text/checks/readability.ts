import type { Sentence, TextDocument } from "../model"
import type { CheckContext, CheckSpec, RawFinding, RuleSpec, Severity } from "../rules"
import { findBuriedList } from "./buried"
import { findNoChain } from "./chain"
import { findCommaRun } from "./commas"
import { findKanjiRun } from "./kanji"
import { findLongSentence } from "./length"
import { findDoubleNegative } from "./negation"
import { COUNTED_KINDS } from "./register"
import { sentenceTokens } from "./tokenized"

/** A rule on by default that needs no morphology, explained in `readability.md` under its id. */
function rule(id: string, severity: Severity, extra: Partial<RuleSpec> = {}): RuleSpec {
  return {
    id,
    check: "readability",
    severity,
    defaultOn: true,
    morphology: false,
    reference: `readability.md#${id}`,
    ...extra,
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
    spec: rule("long_sentence", "info"),
    find: ({ doc, thresholds }) => findLongSentence(doc, readableSentences(doc), thresholds.sentence_length),
  },
  {
    spec: rule("kanji_run", "info"),
    find: ({ doc, thresholds }) => findKanjiRun(doc, readableSentences(doc), thresholds.kanji_run),
  },
  {
    spec: rule("comma_run", "info"),
    find: ({ doc }) => findCommaRun(doc, readableSentences(doc)),
  },
  {
    spec: rule("no_chain", "info", { morphology: true }),
    find: ({ doc, tokens, thresholds }) =>
      findNoChain(sentenceTokens(doc, tokens, readableSentences(doc)), thresholds.no_chain),
  },
  {
    spec: rule("double_negative", "warn", { morphology: true }),
    find: ({ doc, tokens }) => findDoubleNegative(sentenceTokens(doc, tokens, readableSentences(doc))),
  },
  {
    spec: rule("buried_list", "info", { morphology: true }),
    find: ({ doc, tokens }) => findBuriedList(doc, sentenceTokens(doc, tokens, readableSentences(doc))),
  },
]

/**
 * How easily the text reads: sentences past the length the thresholds allow,
 * runs of kanji, short clauses in a row, and, from the engine's tokens,
 * chained の, double negatives and lists buried in a sentence. Most are
 * patterns the writer weighs and report at `info`; a double negative, which
 * most readers pay for, is a `warn`. The thresholds come from the settings,
 * else from the genre.
 */
export const readabilityCheck: CheckSpec = {
  name: "readability",
  rules: FINDING_RULES.map(({ spec }) => spec),
  run(ctx) {
    return { findings: FINDING_RULES.filter(({ spec }) => ctx.enabled(spec.id)).flatMap(({ find }) => find(ctx)) }
  },
}
