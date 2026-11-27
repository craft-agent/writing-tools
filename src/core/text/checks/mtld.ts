import { MTLD_FACTOR } from "./thresholds"

/**
 * The factors one pass over the words makes: a factor is a stretch of words
 * whose type-token ratio has fallen to the threshold, and the stretch left at
 * the end counts as the share of a factor its ratio has covered.
 */
function factorsOf(words: readonly string[]): number {
  let factors = 0
  let types = new Set<string>()
  let count = 0
  for (const word of words) {
    types.add(word)
    count++
    if (types.size / count <= MTLD_FACTOR) {
      factors++
      types = new Set()
      count = 0
    }
  }
  return count === 0 ? factors : factors + (1 - types.size / count) / (1 - MTLD_FACTOR)
}

/** The words per factor of one pass: how long a stretch of the words stays varied. A pass that never completes a factor gets the number of words. */
function pass(words: readonly string[]): number {
  const factors = factorsOf(words)
  return factors > 0 ? words.length / factors : words.length
}

/**
 * The measure of textual lexical diversity (MTLD) of the words in order: the
 * mean of a pass from the first word and a pass from the last, each the words
 * per factor, so it does not depend on how long the text is. A low value says
 * the words come round again soon; a text of all different words gets its
 * length. No words give 0.
 */
export function mtld(words: readonly string[]): number {
  if (words.length === 0) return 0
  return (pass(words) + pass([...words].reverse())) / 2
}
