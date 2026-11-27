import type { Token } from "../../engine/tokens"
import type { LineKind, TextDocument } from "../model"
import type { RawFinding } from "../rules"
import { CLAIM_VERBS, SUBJECT_MODIFIERS, SUBJECT_NOUNS, SUBJECT_PARTICLES, SUBJECT_PRONOUNS } from "./abstract"
import { sentenceTokens, type BlockTokens } from "./tokenized"

/** The kinds of block whose sentences are read: body text and list items, the ones the engine reads. */
const SUBJECT_KINDS: ReadonlySet<LineKind> = new Set(["prose", "list"])

const NOUN = "名詞"
const PRONOUN = "代名詞"
const ADNOMINAL = "連体詞"
const PARTICLE = "助詞"
const VERB = "動詞"

/** What may stand between a noun and the verb it makes: `する`, or `に` and `する`. The last is the light verb. */
const LIGHT_VERB_TAILS: readonly (readonly string[])[] = [["する"], ["に", "する"]]

/** A claim verb the sentence holds: its dictionary form and the index of its last token. */
type Claim = { verb: string; end: number }

/** The index where the subject starts when the token at `at` is a subject word, with the `この` or `その` before it; `undefined` when it is not. */
function subjectStart(tokens: readonly Token[], at: number): number | undefined {
  const { pos, surface } = tokens[at]
  if (pos[0] === PRONOUN && SUBJECT_PRONOUNS.includes(surface)) return at
  if (pos[0] !== NOUN || !SUBJECT_NOUNS.includes(surface)) return undefined
  const before = tokens[at - 1]
  const modified = before !== undefined && before.pos[0] === ADNOMINAL && SUBJECT_MODIFIERS.includes(before.surface)
  return modified ? at - 1 : at
}

/** The claim verb that starts at `at`: a verb of the list, or a noun with the light verb after it that makes one. */
function claimAt(tokens: readonly Token[], at: number): Claim | undefined {
  const { pos, dictionary } = tokens[at]
  if (pos[0] === VERB) return CLAIM_VERBS.has(dictionary) ? { verb: dictionary, end: at } : undefined
  if (pos[0] !== NOUN) return undefined
  for (const tail of LIGHT_VERB_TAILS) {
    const after = tokens.slice(at + 1, at + 1 + tail.length)
    const light = after[tail.length - 1]
    const matches =
      after.length === tail.length &&
      light.pos[0] === VERB &&
      light.dictionary === tail[tail.length - 1] &&
      after.slice(0, -1).every(({ surface }, n) => surface === tail[n])
    const verb = `${dictionary}${tail.join("")}`
    if (matches && CLAIM_VERBS.has(verb)) return { verb, end: at + tail.length }
  }
  return undefined
}

/** The first claim verb after the subject particle at `particleAt`, `undefined` when the sentence has none. */
function claimAfter(tokens: readonly Token[], particleAt: number): Claim | undefined {
  for (let at = particleAt + 1; at < tokens.length; at++) {
    const claim = claimAt(tokens, at)
    if (claim !== undefined) return claim
  }
  return undefined
}

/**
 * The `inanimate_subject` findings: a sentence of body text or a list item
 * whose subject is a demonstrative or an abstract noun from the package's
 * list, marked by `が` or `は`, and that has a verb of the package's list of
 * claim verbs after it. One finding per sentence, for the first such subject,
 * spanning the subject through the verb.
 */
export function findInanimateSubject(doc: TextDocument, tokens: BlockTokens): RawFinding[] {
  const sentences = doc.sentences.filter(({ kind }) => SUBJECT_KINDS.has(kind))
  return sentenceTokens(doc, tokens, sentences).flatMap(({ tokens: inside }) => {
    for (let at = 0; at < inside.length - 1; at++) {
      const start = subjectStart(inside, at)
      const particle = inside[at + 1]
      if (start === undefined || particle.pos[0] !== PARTICLE || !SUBJECT_PARTICLES.includes(particle.surface)) continue
      const claim = claimAfter(inside, at + 1)
      if (claim === undefined) continue
      const subject = inside
        .slice(start, at + 1)
        .map(({ surface }) => surface)
        .join("")
      return [
        {
          rule: "inanimate_subject",
          start: inside[start].start,
          end: inside[claim.end].end,
          reason: `the abstract subject "${subject}" takes the verb "${claim.verb}"; a person or an action as the subject may read more directly`,
        },
      ]
    }
    return []
  })
}
