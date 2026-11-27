import type { IndexPair } from "./lcs"

/** The least Dice coefficient of two sentences' character bigrams at which they count as one sentence revised. */
export const MIN_LIKENESS = 0.5

/** The most pairs of sentences one stretch of changed sentences compares; past it each sentence is compared with a window of the other side around the same relative position. */
const MAX_COMPARISONS = 1_000_000

/** One pair of sentences that are alike enough, with how alike. */
type Candidate = { first: number; second: number; score: number }

/** The distinct pairs of neighbouring code points of a key; a key of one code point is its own gram. */
function gramsOf(key: string): Set<string> {
  const points = Array.from(key)
  if (points.length < 2) return new Set([key])
  return new Set(points.slice(1).map((point, at) => points[at] + point))
}

/** The Dice coefficient of two sets of grams: twice what they share over what they hold, from 0 to 1. */
function dice(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  let shared = 0
  for (const gram of smaller) if (larger.has(gram)) shared++
  return (2 * shared) / (a.size + b.size)
}

/** Every pair of at least {@link MIN_LIKENESS}, comparing each key of the first side with a window of the second. */
function candidatesOf(first: readonly Set<string>[], second: readonly Set<string>[]): Candidate[] {
  const window = Math.min(second.length, Math.max(1, Math.floor(MAX_COMPARISONS / first.length)))
  const found: Candidate[] = []
  for (const [at, grams] of first.entries()) {
    const centre = Math.round(((at + 0.5) * second.length) / first.length)
    const low = Math.max(0, Math.min(centre - (window >> 1), second.length - window))
    for (let other = low; other < low + window; other++) {
      const score = dice(grams, second[other])
      if (score >= MIN_LIKENESS) found.push({ first: at, second: other, score })
    }
  }
  return found
}

/** Where `pairs`, sorted by their first index, would take a pair of that first index. */
function insertionPoint(pairs: readonly IndexPair[], first: number): number {
  let low = 0
  let high = pairs.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (pairs[middle][0] < first) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Pairs the sentences of two stretches of changed text by how alike they are,
 * given as their keys: the pair with the highest Dice coefficient of character
 * bigrams first (the earlier one on a tie), as long as it is at least
 * {@link MIN_LIKENESS}, uses no sentence twice and does not cross a pair
 * already taken. The pairs come sorted by the first index, which counts in
 * `first`; the sentences without one are the dropped and the added.
 */
export function likePairs(first: readonly string[], second: readonly string[]): IndexPair[] {
  if (first.length === 0 || second.length === 0) return []
  const candidates = candidatesOf(first.map(gramsOf), second.map(gramsOf))
  candidates.sort((a, b) => b.score - a.score || a.first - b.first || a.second - b.second)
  const taken: IndexPair[] = []
  for (const { first: at, second: other } of candidates) {
    const place = insertionPoint(taken, at)
    const crossesBefore = place > 0 && taken[place - 1][1] >= other
    const crossesAfter = place < taken.length && (taken[place][0] === at || taken[place][1] <= other)
    if (!crossesBefore && !crossesAfter) taken.splice(place, 0, [at, other])
  }
  return taken
}
