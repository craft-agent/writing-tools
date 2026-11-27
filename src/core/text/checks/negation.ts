import type { Token } from "../../engine/tokens"
import type { RawFinding } from "../rules"
import {
  ADJECTIVE,
  AUXILIARY_VERB,
  CONJUNCTIVE_PARTICLE,
  NOMINALIZING_PARTICLE,
  NOUN,
  PARTICLE,
  VERB,
  isParticle,
} from "./pos"
import { DOUBLE_NEGATIVE_MAX_GAP } from "./thresholds"
import type { SentenceTokens } from "./tokenized"

/** The dictionary or normalized forms of the negations: ない and 無い, and ぬ and ず, the classical ones (`ん` of `ません` is ぬ). */
const NEGATION_FORMS: ReadonlySet<string> = new Set(["ない", "無い", "ぬ", "ず"])

/** The parts of speech a negation has: the auxiliary of `行かない` and the adjective of `問題がない`. */
const NEGATION_POS: ReadonlySet<string> = new Set([AUXILIARY_VERB, ADJECTIVE])

/** The verb `得る`, whose negative closes `ざるを得ない`. */
const OBTAIN = "得る"

/**
 * The formal nouns that may stand between two negations (`ないわけではない`,
 * `ないはずがない`), by dictionary or normalized form. The nominalizing の
 * (`ないのではない`, `ないんじゃない`) is one of them. The package's own list.
 */
const FORMAL_NOUNS: ReadonlySet<string> = new Set(["わけ", "訳", "こと", "事", "の", "はず", "筈", "もの", "物"])

/** The particles and the copula that may stand between two negations, by surface: `は も が で でも では じゃ と に`. */
const LINKING_WORDS: ReadonlySet<string> = new Set(["は", "も", "が", "で", "でも", "では", "じゃ", "と", "に"])

/** The polite copula of `ではありません`: the verb `ある` and the auxiliary `ます`, by dictionary form. */
const POLITE_COPULA: ReadonlySet<string> = new Set(["ある", "ます"])

/** Whether the token may stand between the two negations of a double negative: no content word does. */
function mayLinkNegations({ pos, surface, dictionary, normalized }: Token): boolean {
  const formal = FORMAL_NOUNS.has(dictionary) || FORMAL_NOUNS.has(normalized)
  if (pos[0] === NOUN || (pos[0] === PARTICLE && pos[1] === NOMINALIZING_PARTICLE)) return formal
  if (pos[0] === PARTICLE || pos[0] === AUXILIARY_VERB)
    return LINKING_WORDS.has(surface) || POLITE_COPULA.has(dictionary)
  return pos[0] === VERB && POLITE_COPULA.has(dictionary)
}

/** Whether the token is a negation. */
function isNegation({ pos, dictionary, normalized }: Token): boolean {
  return NEGATION_POS.has(pos[0]) && (NEGATION_FORMS.has(dictionary) || NEGATION_FORMS.has(normalized))
}

/**
 * Whether the negation at `at` is followed by a conditional: `ば`, a
 * conjunctive `と`, `なら`, or `て` and `は`. A negation before one is a
 * condition, not a denial, which makes `なければならない`, `なくてはいけない`
 * and `ないといけない` obligations and `なければ` or `ないなら` plain
 * conditions, so it is not counted. `とは` is the quoting particle and
 * does not count as one.
 */
function precedesConditional(tokens: readonly Token[], at: number): boolean {
  const next = tokens[at + 1]
  if (next === undefined) return false
  if (next.surface === "ば" || next.surface === "と") return isParticle(next, CONJUNCTIVE_PARTICLE)
  if (next.surface === "なら") return true
  return next.surface === "て" && tokens[at + 2]?.surface === "は"
}

/** Whether the negation at `at` is part of an idiom whose meaning is not a denial: `ずにはいられない`, `ないではすまない`, `ざるを得ない`. */
function startsIdiom(tokens: readonly Token[], at: number): boolean {
  const [, next, after] = tokens.slice(at, at + 3)
  if (next === undefined || after === undefined) return false
  if ((next.surface === "に" || next.surface === "で") && after.surface === "は") return true
  return next.surface === "を" && after.dictionary === OBTAIN
}

/** Whether the token at `at` is a negation that counts: one that is no condition and no idiom. */
function countsAsNegation(tokens: readonly Token[], at: number): boolean {
  return isNegation(tokens[at]) && !precedesConditional(tokens, at) && !startsIdiom(tokens, at)
}

/**
 * The `double_negative` findings: in each sentence, two negations within six
 * tokens of each other with only formal nouns, particles and the copula
 * between them (`ないわけではない`, `ないはずがない`; not `言わず何も食べなかった`,
 * which has content words between), one finding per pair, from the first
 * negation through the second. A negation counted in one pair is not counted
 * in the next, so `A ない B ない C ない` reports its first two. Obligations
 * (`なければならない`), conditions (`なければ`, `ないと`) and idioms
 * (`ざるを得ない`, `ずにはいられない`) are not negations here.
 */
export function findDoubleNegative(sentences: readonly SentenceTokens[]): RawFinding[] {
  return sentences.flatMap(({ tokens }) => {
    const negations = tokens.flatMap((_, at) => (countsAsNegation(tokens, at) ? [at] : []))
    const findings: RawFinding[] = []
    for (let n = 0; n < negations.length - 1; n++) {
      const [first, second] = [negations[n], negations[n + 1]]
      if (second - first > DOUBLE_NEGATIVE_MAX_GAP || !tokens.slice(first + 1, second).every(mayLinkNegations)) continue
      findings.push({
        rule: "double_negative",
        start: tokens[first].start,
        end: tokens[second].end,
        reason: `two negations with only a formal noun, particles or the copula between them, which the reader must cancel against each other; stating the point without them may read clearer`,
      })
      n++
    }
    return findings
  })
}
