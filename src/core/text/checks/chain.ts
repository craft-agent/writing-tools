import type { Token } from "../../engine/tokens"
import type { RawFinding } from "../rules"
import { CASE_PARTICLE, CLOSING_PARENTHESES, OPENING_PARENTHESES, isParticle, isSymbol } from "./pos"
import { NO_CHAIN_MAX_GAP } from "./thresholds"
import type { SentenceTokens } from "./tokenized"

const NO = "の"

/**
 * The tokens of a sentence without what stands in parentheses, the
 * parentheses included: an aside neither joins a chain nor breaks it, so the
 * tokens on either side of it are read as if it were not there. A closing
 * parenthesis with no opening one stays, and breaks a chain like any mark.
 */
function outsideParentheses(tokens: readonly Token[]): Token[] {
  let depth = 0
  return tokens.filter(({ surface }) => {
    if (OPENING_PARENTHESES.has(surface)) {
      depth++
      return false
    }
    if (CLOSING_PARENTHESES.has(surface) && depth > 0) {
      depth--
      return false
    }
    return depth === 0
  })
}

/** The chains of case-marking の in the tokens, as the indexes of their の: each の follows the one before within the gap, with no mark between. */
function chainsOf(tokens: readonly Token[]): number[][] {
  const chains: number[][] = []
  let current: number[] | undefined
  for (const [at, token] of tokens.entries()) {
    if (token.surface !== NO || !isParticle(token, CASE_PARTICLE)) continue
    const last = current?.[current.length - 1]
    const joins = last !== undefined && at - last <= NO_CHAIN_MAX_GAP && !tokens.slice(last + 1, at).some(isSymbol)
    if (joins) {
      current!.push(at)
    } else {
      current = [at]
      chains.push(current)
    }
  }
  return chains
}

/** The start of the token before `at` and the end of the token after `to`, when they are words; otherwise the edges of the の themselves. */
function spanOf(tokens: readonly Token[], at: number, to: number): { start: number; end: number } {
  const before = tokens[at - 1]
  const after = tokens[to + 1]
  return {
    start: (before !== undefined && !isSymbol(before) ? before : tokens[at]).start,
    end: (after !== undefined && !isSymbol(after) ? after : tokens[to]).end,
  }
}

/**
 * The `no_chain` findings: in each sentence, every chain of more than `limit`
 * case-marking の, one finding per chain, from the token before its first の
 * through the token after its last, so the span reads as the phrase
 * (`東京の会社の部長の名前`); where one is missing or is a mark, the span
 * stops at the の. The の that nominalizes or ends a sentence is not counted,
 * and nor is what stands in parentheses.
 */
export function findNoChain(sentences: readonly SentenceTokens[], limit: number): RawFinding[] {
  return sentences.flatMap(({ tokens }) => {
    const readable = outsideParentheses(tokens)
    return chainsOf(readable)
      .filter((chain) => chain.length > limit)
      .map((chain) => ({
        rule: "no_chain",
        ...spanOf(readable, chain[0], chain[chain.length - 1]),
        reason: `${chain.length} case-marking の in a chain, past ${limit}; rewording some as a verb, a compound or a separate clause may read lighter`,
      }))
  })
}
