import type { Token } from "../../engine/tokens"
import type { TextDocument } from "../model"
import type { RawFinding } from "../rules"
import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../sentences"
import { COMMAS } from "./chars"
import { compactLength } from "./length"
import {
  CASE_PARTICLE,
  CLOSING_PARENTHESES,
  OPENING_PARENTHESES,
  PREFIX,
  isNoun,
  isNounSuffix,
  isParticle,
  isSymbol,
} from "./pos"
import { BURIED_LIST_LIMITS } from "./thresholds"
import type { SentenceTokens } from "./tokenized"

const NO = "の"

/** A part of a sentence between two commas, and the index of the noun it ends in, `undefined` when it ends in another word. */
type Segment = { tokens: readonly Token[]; noun: number | undefined }

/** The tokens of a sentence split at the commas outside brackets; the commas are dropped. */
function splitAtCommas(tokens: readonly Token[]): Token[][] {
  const segments: Token[][] = [[]]
  let depth = 0
  for (const token of tokens) {
    if (OPENING_BRACKETS.has(token.surface)) {
      depth++
    } else if (CLOSING_BRACKETS.has(token.surface)) {
      depth = Math.max(0, depth - 1)
    } else if (depth === 0 && COMMAS.includes(token.surface)) {
      segments.push([])
      continue
    }
    segments[segments.length - 1].push(token)
  }
  return segments
}

/** The index of the parenthesis that opens the one closing at `closeAt`; `closeAt` itself when none does. */
function openingOf(tokens: readonly Token[], closeAt: number): number {
  let depth = 0
  for (let at = closeAt; at >= 0; at--) {
    if (CLOSING_PARENTHESES.has(tokens[at].surface)) {
      depth++
    } else if (OPENING_PARENTHESES.has(tokens[at].surface)) {
      depth--
      if (depth === 0) return at
    }
  }
  return closeAt
}

/**
 * The index of the noun a segment ends in. The marks after it do not count,
 * and a parenthetical after it is an aside (`B（注）` ends in B); a suffix
 * counts when it follows a noun (`利用者`).
 */
function finalNoun(tokens: readonly Token[]): number | undefined {
  let at = tokens.length - 1
  while (at >= 0 && isSymbol(tokens[at])) {
    at = CLOSING_PARENTHESES.has(tokens[at].surface) ? openingOf(tokens, at) - 1 : at - 1
  }
  if (at < 0) return undefined
  const joinsNoun = at > 0 && (isNoun(tokens[at - 1]) || isNounSuffix(tokens[at - 1]))
  return isNoun(tokens[at]) || (isNounSuffix(tokens[at]) && joinsNoun) ? at : undefined
}

/**
 * Where the noun phrase that opens a segment ends, as an offset in the text;
 * `undefined` when the segment does not open with a noun. A prefix may come
 * before the noun, and the phrase goes on through the nouns and suffixes that
 * follow it and through の and a noun (`焼きたての菓子`). A bracket that
 * opened before the noun and closes right after the phrase is part of it.
 */
function openingPhraseEnd(tokens: readonly Token[]): number | undefined {
  let at = tokens.findIndex((token) => !isSymbol(token))
  if (at < 0) return undefined
  const opened = at
  if (tokens[at].pos[0] === PREFIX) at++
  if (tokens[at] === undefined || !isNoun(tokens[at])) return undefined
  let end = at
  while (end + 1 < tokens.length) {
    const next = tokens[end + 1]
    if (isNoun(next) || isNounSuffix(next)) {
      end++
    } else if (next.surface === NO && isParticle(next, CASE_PARTICLE) && tokens[end + 2] && isNoun(tokens[end + 2])) {
      end += 2
    } else {
      break
    }
  }
  for (
    let closers = 0;
    closers < opened && tokens[end + 1] && CLOSING_BRACKETS.has(tokens[end + 1].surface);
    closers++
  ) {
    end++
  }
  return tokens[end].end
}

/** The sentence length at or past which a list of `items` is reported; `undefined` when the list is too short to be. */
function lengthLimit(items: number): number | undefined {
  return BURIED_LIST_LIMITS.find((limit) => items >= limit.items)?.length
}

/**
 * The `buried_list` findings: in each sentence, every run of items split by
 * commas that each end in a noun, closed by an item that opens with a noun,
 * when the sentence is long enough for the number of items (80 characters for
 * three, 50 for four or more). A run that reaches the end of the sentence is
 * closed by its own last item. One finding per list, from the start of its
 * first item through the end of the noun phrase that opens its last.
 */
export function findBuriedList(doc: TextDocument, sentences: readonly SentenceTokens[]): RawFinding[] {
  return sentences.flatMap(({ sentence, tokens }) => {
    const segments = splitAtCommas(tokens).map((part): Segment => ({ tokens: part, noun: finalNoun(part) }))
    const length = compactLength(doc.masked.slice(sentence.start, sentence.end))
    const findings: RawFinding[] = []
    for (let first = 0; first < segments.length; first++) {
      if (segments[first].noun === undefined) continue
      let after = first
      while (after < segments.length && segments[after].noun !== undefined) after++
      const run = segments.slice(first, after)
      const closing = segments[after]
      const end =
        closing === undefined
          ? run[run.length - 1].tokens[run[run.length - 1].noun!].end
          : openingPhraseEnd(closing.tokens)
      const items = closing === undefined ? run.length : run.length + 1
      const limit = lengthLimit(items)
      if (end !== undefined && limit !== undefined && length >= limit) {
        findings.push({
          rule: "buried_list",
          start: run[0].tokens[0].start,
          end,
          reason: `${items} items split by commas in a sentence of ${length} characters, ${limit} or more; a bulleted list may read easier`,
        })
      }
      first = after
    }
    return findings
  })
}
