import { describe, expect, test } from "bun:test"
import { excerptOf } from "./excerpt"
import { MAX_EXCERPT } from "./limits"

const points = (text: string) => Array.from(text).length

describe("excerptOf", () => {
  test("returns a short text whole, with no ellipsis", () => {
    expect(excerptOf("これはテストです。", 3, 7)).toBe("これはテストです。")
  })

  test("centres the span and counts both ellipses within the limit", () => {
    const text = `${"a".repeat(100)}XY${"b".repeat(100)}`
    expect(excerptOf(text, 100, 102)).toBe(`…${"a".repeat(38)}XY${"b".repeat(38)}…`)
  })

  test("clips only the end that has more text, and fills the room", () => {
    const text = `XY${"b".repeat(200)}`
    expect(excerptOf(text, 0, 2)).toBe(`XY${"b".repeat(77)}…`)
    const tail = `${"a".repeat(200)}XY`
    expect(excerptOf(tail, 200, 202)).toBe(`…${"a".repeat(77)}XY`)
  })

  test("starts at the span when the span is wider than the excerpt", () => {
    const text = `head ${"x".repeat(200)}`
    expect(excerptOf(text, 5, 205)).toBe(`…${"x".repeat(78)}…`)
    expect(excerptOf(`${"y".repeat(200)}`, 0, 200)).toBe(`${"y".repeat(79)}…`)
  })

  test("centres an empty span, such as a missing space", () => {
    const text = `${"a".repeat(100)}${"b".repeat(100)}`
    expect(excerptOf(text, 100, 100)).toBe(`…${"a".repeat(39)}${"b".repeat(39)}…`)
  })

  test("counts code points, not UTF-16 units, and never splits a pair", () => {
    const text = "😀".repeat(100)
    expect(excerptOf(text, 100, 102)).toBe(`…${"😀".repeat(78)}…`)
  })

  test("keeps a pair whole where the reach would cut it", () => {
    const text = `${"😀".repeat(150)}b${"😀".repeat(150)}`
    expect(excerptOf(text, 301, 303)).toBe(`…${"😀".repeat(37)}b${"😀".repeat(40)}…`)
  })

  test("shows every kind of line break as one space", () => {
    expect(excerptOf("ab\ncd\r\nef\rgh", 0, 12)).toBe("ab cd ef gh")
  })

  test("clamps a span that runs past the text", () => {
    expect(excerptOf("abc", 1, 99)).toBe("abc")
    expect(excerptOf("abc", 99, 120)).toBe("abc")
  })

  test("never exceeds the limit wherever the span lies", () => {
    const text = `${"あ😀\n".repeat(120)}end`
    for (const start of [0, 1, 5, 80, 159, 160, 161, 200, 300, text.length - 3, text.length]) {
      for (const length of [0, 1, 2, 40, 79, 80, 81, 150, 500]) {
        expect(points(excerptOf(text, start, start + length))).toBeLessThanOrEqual(MAX_EXCERPT)
      }
    }
  })

  test("reads only the text near the span", () => {
    const text = "あ".repeat(2_000_000)
    expect(points(excerptOf(text, 1_000_000, 1_000_003))).toBe(MAX_EXCERPT)
  })
})
