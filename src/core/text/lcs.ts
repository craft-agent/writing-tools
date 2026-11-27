/** The largest table, in cells, that the exact search fills in; a stretch past it is cut first at the keys both sequences hold once. */
const MAX_TABLE_CELLS = 4_000_000

/** A pair of indexes, one into each sequence. */
export type IndexPair = readonly [number, number]

/** A stretch of both sequences, each half-open: `[aLow, aHigh)` of the first and `[bLow, bHigh)` of the second. */
type Range = { aLow: number; aHigh: number; bLow: number; bHigh: number }

/** The keys of both sequences as small integers, so that comparing two of them never reads a string. */
function idsOf(a: readonly string[], b: readonly string[]): [Int32Array, Int32Array] {
  const known = new Map<string, number>()
  const idOf = (key: string): number => {
    const found = known.get(key)
    if (found !== undefined) return found
    known.set(key, known.size)
    return known.size - 1
  }
  return [Int32Array.from(a, idOf), Int32Array.from(b, idOf)]
}

/** Takes the keys the two stretches share at their start and at their end as pairs, and returns what is left between them. */
function trimmed(a: Int32Array, b: Int32Array, range: Range, pairs: IndexPair[]): Range {
  let { aLow, aHigh, bLow, bHigh } = range
  while (aLow < aHigh && bLow < bHigh && a[aLow] === b[bLow]) pairs.push([aLow++, bLow++])
  while (aLow < aHigh && bLow < bHigh && a[aHigh - 1] === b[bHigh - 1]) pairs.push([--aHigh, --bHigh])
  return { aLow, aHigh, bLow, bHigh }
}

/** The longest common subsequence of the stretches, from a table of the suffixes' lengths walked from the start. */
function tablePairs(a: Int32Array, b: Int32Array, range: Range, pairs: IndexPair[]): void {
  const rows = range.aHigh - range.aLow
  const width = range.bHigh - range.bLow + 1
  const lengths = new Uint16Array((rows + 1) * width)
  for (let row = rows - 1; row >= 0; row--) {
    for (let column = width - 2; column >= 0; column--) {
      lengths[row * width + column] =
        a[range.aLow + row] === b[range.bLow + column]
          ? lengths[(row + 1) * width + column + 1] + 1
          : Math.max(lengths[(row + 1) * width + column], lengths[row * width + column + 1])
    }
  }
  let row = 0
  let column = 0
  while (row < rows && column < width - 1) {
    if (a[range.aLow + row] === b[range.bLow + column]) {
      pairs.push([range.aLow + row++, range.bLow + column++])
    } else if (lengths[(row + 1) * width + column] >= lengths[row * width + column + 1]) {
      row++
    } else {
      column++
    }
  }
}

/** The positions of each key in `[low, high)` that stands there once, and -1 for a key that stands more than once. */
function singles(ids: Int32Array, low: number, high: number): Map<number, number> {
  const positions = new Map<number, number>()
  for (let at = low; at < high; at++) positions.set(ids[at], positions.has(ids[at]) ? -1 : at)
  return positions
}

/** The longest run of `anchors` (sorted by their first index) whose second indexes also rise: the keys both stretches hold once that keep their order. */
function risingAnchors(anchors: readonly IndexPair[]): IndexPair[] {
  const tails: number[] = []
  const previous: number[] = Array.from({ length: anchors.length }, () => -1)
  for (const [at, [, second]] of anchors.entries()) {
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (anchors[tails[middle]][1] < second) low = middle + 1
      else high = middle
    }
    previous[at] = low > 0 ? tails[low - 1] : -1
    tails[low] = at
  }
  const chain: IndexPair[] = []
  for (let at = tails.length > 0 ? tails[tails.length - 1] : -1; at >= 0; at = previous[at]) chain.push(anchors[at])
  return chain.reverse()
}

/** The keys that stand once in both stretches, in the order they keep in both. */
function uniqueAnchors(a: Int32Array, b: Int32Array, range: Range): IndexPair[] {
  const inSecond = singles(b, range.bLow, range.bHigh)
  const anchors: IndexPair[] = []
  for (const [id, first] of singles(a, range.aLow, range.aHigh)) {
    const second = inSecond.get(id)
    if (first >= 0 && second !== undefined && second >= 0) anchors.push([first, second])
  }
  return risingAnchors(anchors.sort((x, y) => x[0] - y[0]))
}

/** Pairs each key of the first stretch with the next equal key of the second that comes after the previous pair: in order, though not always the most pairs. */
function greedyPairs(a: Int32Array, b: Int32Array, range: Range, pairs: IndexPair[]): void {
  const queues = new Map<number, number[]>()
  for (let at = range.bLow; at < range.bHigh; at++) {
    const queue = queues.get(b[at])
    if (queue === undefined) queues.set(b[at], [at])
    else queue.push(at)
  }
  const heads = new Map<number, number>()
  let next = range.bLow
  for (let at = range.aLow; at < range.aHigh; at++) {
    const queue = queues.get(a[at])
    if (queue === undefined) continue
    let head = heads.get(a[at]) ?? 0
    while (head < queue.length && queue[head] < next) head++
    heads.set(a[at], head)
    if (head === queue.length) continue
    pairs.push([at, queue[head]])
    next = queue[head] + 1
  }
}

/**
 * The indexes at which two sequences of keys hold the same key, as pairs that
 * keep their order in both, sorted by the first index. The keys at the start
 * and at the end that the sequences share are paired first. What lies between
 * them is a longest common subsequence when its table fits
 * {@link MAX_TABLE_CELLS}; otherwise it is cut at the keys that stand once in
 * both stretches, in the longest run that keeps its order (a patience diff),
 * and each stretch between two of them is searched the same way. A stretch
 * with no such key is paired greedily, in order. The result is the same for
 * the same input, and costs far less than the product of the lengths for texts
 * whose changes are few.
 */
export function commonPairs(a: readonly string[], b: readonly string[]): IndexPair[] {
  const [first, second] = idsOf(a, b)
  const pairs: IndexPair[] = []
  const pending: Range[] = [{ aLow: 0, aHigh: a.length, bLow: 0, bHigh: b.length }]
  while (pending.length > 0) {
    const range = trimmed(first, second, pending.pop()!, pairs)
    const rows = range.aHigh - range.aLow
    const columns = range.bHigh - range.bLow
    if (rows === 0 || columns === 0) continue
    if (rows * columns <= MAX_TABLE_CELLS) {
      tablePairs(first, second, range, pairs)
      continue
    }
    const anchors = uniqueAnchors(first, second, range)
    if (anchors.length === 0) {
      greedyPairs(first, second, range, pairs)
      continue
    }
    let aLow = range.aLow
    let bLow = range.bLow
    for (const [at, other] of anchors) {
      pending.push({ aLow, aHigh: at, bLow, bHigh: other })
      pairs.push([at, other])
      aLow = at + 1
      bLow = other + 1
    }
    pending.push({ aLow, aHigh: range.aHigh, bLow, bHigh: range.bHigh })
  }
  return pairs.sort((x, y) => x[0] - y[0])
}
