import type { CheckContext, CheckSpec, RawFinding, RuleSpec, Severity } from "../rules"
import { mergeResults } from "../rules"
import { findBoldNotRendered } from "./bold"
import { findContrastOveruse } from "./contrast"
import { judgeConvention } from "./convention"
import { findBoldDensity, findListDensity } from "./density"
import { findEmoji } from "./emoji"
import { BUZZWORD_REASON, METAPHOR_REASON, METAPHOR_VERBS, VAGUE_BUZZWORDS } from "./figurative"
import { readableLines } from "./lines"
import { findRewrites, findWords } from "./phrases"
import { findRegister } from "./register"
import { findChoppySentences, findEndingRepetition, findUniformSentenceLength } from "./rhythm"
import { findStanceEnding } from "./stance"
import { STOCK_PHRASES } from "./stock"
import { TRANSLATIONESE } from "./translationese"

/** The `register` rule: a convention rule on by default that needs no morphology, explained in `expression.md`. */
const REGISTER_RULE: RuleSpec = {
  id: "register",
  check: "expression",
  severity: "warn",
  defaultOn: true,
  morphology: false,
  reference: "expression.md#register",
}

/** A rule on by default that needs no morphology, explained in `expression.md` under its id. */
function rule(id: string, severity: Severity, extra: Partial<RuleSpec> = {}): RuleSpec {
  return {
    id,
    check: "expression",
    severity,
    defaultOn: true,
    morphology: false,
    reference: `expression.md#${id}`,
    ...extra,
  }
}

/** A rule that reports findings, not a convention: its spec, and where it finds them. */
type FindingRule = { spec: RuleSpec; find(ctx: CheckContext): RawFinding[] }

const FINDING_RULES: readonly FindingRule[] = [
  {
    spec: rule("bold_not_rendered", "critical"),
    find: ({ doc }) => findBoldNotRendered(doc, readableLines(doc)),
  },
  {
    spec: rule("bold_density", "info"),
    find: ({ doc, genre }) => findBoldDensity(doc, readableLines(doc), genre),
  },
  {
    spec: rule("list_density", "info", { genres: ["general", "essay"] }),
    find: ({ doc, genre }) => findListDensity(readableLines(doc), genre),
  },
  {
    spec: rule("ending_repetition", "info"),
    find: ({ doc }) => findEndingRepetition(doc),
  },
  {
    spec: rule("choppy_sentences", "info"),
    find: ({ doc, genre }) => findChoppySentences(doc, genre),
  },
  {
    spec: rule("uniform_sentence_length", "info"),
    find: ({ doc, genre }) => findUniformSentenceLength(doc, genre),
  },
  {
    spec: rule("stance_ending", "warn", { needsStance: true }),
    find: ({ doc, stance }) => (stance === undefined ? [] : findStanceEnding(doc, stance)),
  },
  {
    spec: rule("stock_phrase", "info"),
    find: ({ doc }) => findRewrites(readableLines(doc), "stock_phrase", STOCK_PHRASES),
  },
  {
    spec: rule("translationese", "info"),
    find: ({ doc }) => findRewrites(readableLines(doc), "translationese", TRANSLATIONESE),
  },
  {
    spec: rule("vague_buzzword", "info", { defaultOn: false }),
    find: ({ doc }) => findWords(readableLines(doc), "vague_buzzword", VAGUE_BUZZWORDS, BUZZWORD_REASON),
  },
  {
    spec: rule("metaphor_verb", "info", { defaultOn: false }),
    find: ({ doc }) => findWords(readableLines(doc), "metaphor_verb", METAPHOR_VERBS, METAPHOR_REASON),
  },
  {
    spec: rule("contrast_overuse", "info", { defaultOn: false }),
    find: ({ doc, genre }) => findContrastOveruse(doc, readableLines(doc), genre),
  },
  {
    spec: rule("emoji", "info", { defaultOn: false }),
    find: ({ doc }) => findEmoji(readableLines(doc)),
  },
]

/**
 * Voice and wording: the register of the sentences, held to the `register`
 * convention's value or to the text's own majority; the Markdown bold that
 * does not render and the density of bold and lists; the rhythm of the
 * sentence endings and lengths; the endings a stance rules out; the phrases
 * that add length and no meaning, and the constructions carried over from a
 * translation; and, when `rules` names them, the buzzwords, metaphors, runs of
 * contrast constructions and emoji. A rule that is off is neither run nor
 * settled.
 */
export const expressionCheck: CheckSpec = {
  name: "expression",
  rules: [REGISTER_RULE, ...FINDING_RULES.map(({ spec }) => spec)],
  run(ctx) {
    const register = ctx.enabled(REGISTER_RULE.id)
      ? judgeConvention(ctx, "register", findRegister(ctx.doc))
      : { findings: [] }
    const findings = FINDING_RULES.filter(({ spec }) => ctx.enabled(spec.id)).flatMap(({ find }) => find(ctx))
    return mergeResults([register, { findings }])
  },
}
