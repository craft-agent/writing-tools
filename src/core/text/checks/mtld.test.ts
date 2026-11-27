import { describe, expect, test } from "bun:test"
import { mtld } from "./mtld"

/** `count` words drawn in turn from `types` different ones. */
function cycle(types: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `w${i % types}`)
}

describe("mtld", () => {
  test("gives a text of one word the lowest value: each factor is two words", () => {
    // After the second word the ratio is 0.5, at or under 0.72, so a factor ends.
    expect(mtld(Array(100).fill("a"))).toBe(2)
  })

  test("gives a text of all different words its length: no stretch ever falls to the threshold", () => {
    expect(mtld(cycle(100, 100))).toBe(100)
    expect(mtld(["a"])).toBe(1)
  })

  test("ends a factor when the ratio of different words to words falls to 0.72", () => {
    // a b c d e a: 5/6 stays above, then b: 5/7 = 0.714 ends the factor, from either end.
    expect(mtld(["a", "b", "c", "d", "e", "a", "b"])).toBe(7)
    // a a: 1/2 ends a factor, then b: the ratio is 1, which leaves nothing of a factor; from the back the same.
    expect(mtld(["a", "a", "b"])).toBe(3)
  })

  test("counts the words left at the end as a share of a factor", () => {
    // a b c d a: no factor ends, and the ratio of 4/5 = 0.8 is (1 - 0.8) / (1 - 0.72) of a factor: 5 / 0.714.
    expect(mtld(["a", "b", "c", "d", "a"])).toBeCloseTo(7, 6)
  })

  test("takes the mean of a pass from each end", () => {
    // From the front, a a ends a factor and b c d e leaves none of one: 6 / 1.
    // From the back, e d c b a a leaves a ratio of 5/6, (1 - 5/6) / 0.28 of a factor: 6 / 0.595.
    expect(mtld(["a", "a", "b", "c", "d", "e"])).toBeCloseTo((6 + 6 / (1 / 6 / 0.28)) / 2, 6)
    expect(mtld(["a", "a", "b", "c", "d", "e"])).toBeCloseTo(8.04, 2)
  })

  test("is lower the sooner the words come round again", () => {
    expect(mtld(cycle(5, 300))).toBeLessThan(mtld(cycle(20, 300)))
    expect(mtld(cycle(20, 300))).toBeLessThan(mtld(cycle(100, 300)))
  })

  test("does not depend on how long the text is, for a steady text", () => {
    const short = mtld(cycle(10, 200))
    const long = mtld(cycle(10, 2000))
    expect(Math.abs(short - long) / long).toBeLessThan(0.1)
  })

  test("gives no words 0", () => {
    expect(mtld([])).toBe(0)
  })
})
