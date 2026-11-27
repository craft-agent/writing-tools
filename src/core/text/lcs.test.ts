import { describe, expect, test } from "bun:test"
import { commonPairs } from "./lcs"

/** The keys as single letters, so a test reads as two words. */
const keys = (word: string): string[] => [...word]

/** The length of a longest common subsequence, by the plain table. */
function bestLength(a: readonly string[], b: readonly string[]): number {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  return table[0][0]
}

/** Checks that `pairs` name equal keys and keep their order in both sequences. */
function expectValid(a: readonly string[], b: readonly string[], pairs: readonly (readonly [number, number])[]) {
  for (const [at, other] of pairs) expect(a[at]).toBe(b[other])
  for (let index = 1; index < pairs.length; index++) {
    expect(pairs[index][0]).toBeGreaterThan(pairs[index - 1][0])
    expect(pairs[index][1]).toBeGreaterThan(pairs[index - 1][1])
  }
}

/** A repeatable stream of numbers from 0 up to but not including `limit`. */
function sequence(seed: number): (limit: number) => number {
  let state = seed
  return (limit) => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return Math.floor((state / 4294967296) * limit)
  }
}

describe("commonPairs", () => {
  test("pairs every key of two equal sequences", () => {
    expect(commonPairs(keys("abc"), keys("abc"))).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ])
  })

  test("pairs nothing when a side is empty or no key is shared", () => {
    expect(commonPairs([], keys("abc"))).toEqual([])
    expect(commonPairs(keys("abc"), [])).toEqual([])
    expect(commonPairs(keys("abc"), keys("xyz"))).toEqual([])
  })

  test("keeps the keys around a change and drops the change", () => {
    expect(commonPairs(keys("abXcd"), keys("abYZcd"))).toEqual([
      [0, 0],
      [1, 1],
      [3, 4],
      [4, 5],
    ])
  })

  test("pairs a key that moved with neither place, since a pair never crosses another", () => {
    const pairs = commonPairs(keys("abcd"), keys("bcda"))
    expect(pairs).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ])
  })

  test("finds a longest common subsequence of every small sequence", () => {
    const next = sequence(7)
    for (let round = 0; round < 300; round++) {
      const a = Array.from({ length: next(14) }, () => "abcd"[next(4)])
      const b = Array.from({ length: next(14) }, () => "abcd"[next(4)])
      const pairs = commonPairs(a, b)
      expectValid(a, b, pairs)
      expect(pairs.length).toBe(bestLength(a, b))
    }
  })

  test("gives the same pairs for the same input", () => {
    const a = keys("abcabcabcabc")
    const b = keys("cbacbacbaabc")
    expect(commonPairs(a, b)).toEqual(commonPairs(a, b))
  })
})

describe("commonPairs on long sequences", () => {
  const sentences = Array.from({ length: 3000 }, (_, index) => `sentence ${index}`)

  test("finds the unchanged keys of a text revised in many places, well under a second", () => {
    const revised = sentences.map((key, index) => (index % 25 === 0 ? `${key} revised` : key))
    revised.splice(1500, 0, "inserted")
    const moved = revised.splice(2000, 1)
    revised.splice(100, 0, ...moved)
    const started = performance.now()
    const pairs = commonPairs(sentences, revised)
    expect(performance.now() - started).toBeLessThan(1000)
    expectValid(sentences, revised, pairs)
    expect(pairs.length).toBeGreaterThanOrEqual(3000 - 120 - 1)
  })

  test("pairs in order, quickly, even when no key stands once", () => {
    const a = Array.from({ length: 3000 }, (_, index) => (index % 2 === 0 ? "x" : "y"))
    const b = Array.from({ length: 3000 }, (_, index) => (index % 3 === 0 ? "y" : "x"))
    const started = performance.now()
    const pairs = commonPairs(a, b)
    expect(performance.now() - started).toBeLessThan(1000)
    expectValid(a, b, pairs)
    expect(pairs.length).toBeGreaterThan(1000)
  })
})
