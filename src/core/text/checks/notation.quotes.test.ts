import { describe, expect, test } from "bun:test"
import { seen } from "./notation.testing"
import { findQuotes } from "./quotes"

const quotes = (text: string) => seen(findQuotes, text)

describe("quotes occurrences", () => {
  test("reads a corner pair as corner and a curly or ASCII pair as double, spanning the pair", () => {
    expect(quotes('「確認」と“確認”と"確認"')).toEqual([
      ["corner", "「確認」"],
      ["double", "“確認”"],
      ["double", '"確認"'],
    ])
  })

  test("never counts 『』, which marks a nested quotation or a title", () => {
    expect(quotes("『吾輩は猫である』を読む")).toEqual([])
    expect(quotes("「彼は『猫』と言った」")).toEqual([["corner", "「彼は『猫』と言った」"]])
  })

  test("never counts a pair with no Japanese character inside", () => {
    expect(quotes('「API」と“OK”と"yes"')).toEqual([])
    expect(quotes("「`確認`」")).toEqual([])
    expect(quotes("「ABC確認」")).toEqual([["corner", "「ABC確認」"]])
  })

  test("never counts a mark that is not closed, or a pair across a line break", () => {
    expect(quotes("「確認と言った")).toEqual([])
    expect(quotes("確認」と言った")).toEqual([])
    expect(quotes("“確認と言った")).toEqual([])
    expect(quotes("「確認\nする」")).toEqual([])
  })

  test("never counts a pair that holds a mark of its own kind, only the pair inside", () => {
    expect(quotes("「外「内」外」")).toEqual([["corner", "「内」"]])
    expect(quotes("“外“内”外”")).toEqual([["double", "“内”"]])
  })

  test("pairs ASCII marks in the order they come on a line", () => {
    expect(quotes('"a" "確認" "b')).toEqual([["double", '"確認"']])
    expect(quotes('"確認')).toEqual([])
  })

  test("reads headings and list items, and never a quotation or a code span", () => {
    expect(quotes("# 「確認」\n\n- “確認”")).toEqual([
      ["corner", "「確認」"],
      ["double", "“確認”"],
    ])
    expect(quotes("> 「確認」")).toEqual([])
    expect(quotes("`「確認」`")).toEqual([])
  })
})
