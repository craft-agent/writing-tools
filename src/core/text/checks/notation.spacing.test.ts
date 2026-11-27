import { describe, expect, test } from "bun:test"
import { findLatinSpacing, findUnitSpacing } from "./spacing"
import { hits, seen } from "./notation.testing"

const latin = (text: string) => seen(findLatinSpacing, text)
const unit = (text: string) => seen(findUnitSpacing, text)

describe("latin_spacing occurrences", () => {
  test("reads adjacent Japanese and Latin as unspaced, spanning the two characters", () => {
    expect(latin("日本語Pythonです")).toEqual([
      ["unspaced", "語P"],
      ["unspaced", "nで"],
    ])
  })

  test("reads ASCII spaces between them as spaced, spanning the spaces", () => {
    expect(latin("日本語 Python です")).toEqual([
      ["spaced", " "],
      ["spaced", " "],
    ])
    expect(latin("日本語  Python")).toEqual([["spaced", "  "]])
  })

  test("takes inline code as a Latin word", () => {
    expect(latin("関数`foo`を呼ぶ")).toEqual([
      ["unspaced", "数`"],
      ["unspaced", "`を"],
    ])
    expect(latin("関数 `foo` を呼ぶ")).toEqual([
      ["spaced", " "],
      ["spaced", " "],
    ])
  })

  test("sees through emphasis markers and link brackets", () => {
    expect(latin("**API**を使う")).toEqual([["unspaced", "I**を"]])
    expect(latin("説明は **API** を使う")).toEqual([
      ["spaced", " "],
      ["spaced", " "],
    ])
    expect(latin("説明は[API](x)を見る")).toEqual([
      ["unspaced", "は[A"],
      ["unspaced", "I](x)を"],
    ])
  })

  test("never counts digits alone, a Latin word before Japanese punctuation or an ideographic space", () => {
    expect(latin("10月に1つ、3人")).toEqual([])
    expect(latin("Python、Ruby。")).toEqual([])
    expect(latin("日本語　Python")).toEqual([])
  })

  test("never reads across a line break", () => {
    expect(latin("日本語\nPython\n日本語")).toEqual([])
  })

  test("never reads a URL or a code block", () => {
    expect(latin("詳細はhttps://example.com/を参照")).toEqual([])
    expect(latin("```\n日本語Python\n```")).toEqual([])
  })

  test("reads a long run of markers in linear time", () => {
    const text = `日${"*".repeat(50_000)}`
    const started = performance.now()
    expect(latin(text)).toEqual([])
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

describe("unit_spacing occurrences", () => {
  test("reads a numeral and a unit, spaced or unspaced", () => {
    expect(unit("容量は100 MBです")).toEqual([["spaced", " "]])
    expect(unit("容量は100MBです")).toEqual([["unspaced", "0M"]])
    expect(unit("5mと3.5 GB と1,000MB")).toEqual([
      ["unspaced", "5m"],
      ["spaced", " "],
      ["unspaced", "0M"],
    ])
  })

  test("reads every unit of the list, and µ in either form", () => {
    expect(unit("10 Mbps 50 Hz 2 kHz 10µs 10μs 4 mAh 3 KiB").map(([value]) => value)).toEqual([
      "spaced",
      "spaced",
      "spaced",
      "unspaced",
      "unspaced",
      "spaced",
      "spaced",
    ])
  })

  test("never counts a numeral inside a name or a version", () => {
    expect(unit("v1.2m x86B abc10MB a-5m foo_5m")).toEqual([])
  })

  test("never counts a unit that is the start of a longer word", () => {
    expect(unit("10 meters 5 gram 3 Bytes 100MBps 20 Vx")).toEqual([])
  })

  test("never counts a percent sign, a degree sign or a degree Celsius", () => {
    expect(unit("100 % 90° 20℃ 20 ℃")).toEqual([])
  })

  test("reads the unit before Japanese text and punctuation", () => {
    expect(unit("100MBを使い、5 mmの")).toEqual([
      ["unspaced", "0M"],
      ["spaced", " "],
    ])
  })
})

describe("the spacing rules as findings", () => {
  test("report an unspaced boundary where the text is held to spaced, and the reverse", () => {
    expect(hits("日本語 Pythonで100MB", { latin_spacing: "spaced", unit_spacing: "spaced" })).toEqual([
      ["latin_spacing", "nで"],
      ["unit_spacing", "0M"],
    ])
    expect(hits("日本語 Pythonで100 MB", { latin_spacing: "unspaced", unit_spacing: "unspaced" })).toEqual([
      ["latin_spacing", " "],
      ["unit_spacing", " "],
    ])
  })

  test("report nothing for a text that is consistent in either convention", () => {
    expect(hits("日本語 Python を使い、100 MB 読む")).toEqual([])
    expect(hits("日本語Pythonを使い、100MB読む")).toEqual([])
  })

  test("read the expected value from a setting, and let the argument win", () => {
    expect(hits("日本語Python", {}, { latin_spacing: "spaced" })).toEqual([["latin_spacing", "語P"]])
    expect(hits("日本語Python", { latin_spacing: "unspaced" }, { latin_spacing: "spaced" })).toEqual([])
  })
})
