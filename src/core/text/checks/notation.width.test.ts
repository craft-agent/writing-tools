import { describe, expect, test } from "bun:test"
import { hits, reasons, seen } from "./notation.testing"
import { findAlnumWidth, findBracketWidth } from "./width"

const alnum = (text: string) => seen(findAlnumWidth, text)
const bracket = (text: string) => seen(findBracketWidth, text)

describe("alnum_width occurrences", () => {
  test("reads a run of fullwidth letters or digits as fullwidth, wherever it is", () => {
    expect(alnum("これはＡＰＩです。２０２４年")).toEqual([
      ["fullwidth", "ＡＰＩ"],
      ["fullwidth", "２０２４"],
    ])
    expect(alnum("ＡＢＣ")).toEqual([["fullwidth", "ＡＢＣ"]])
  })

  test("reads a run of ASCII letters or digits beside Japanese text as halfwidth", () => {
    expect(alnum("2024年のAPIです")).toEqual([
      ["halfwidth", "2024"],
      ["halfwidth", "API"],
    ])
  })

  test("looks two characters either way, and sees through spaces and markers", () => {
    expect(alnum("「API」を使う")).toEqual([["halfwidth", "API"]])
    expect(alnum("日本語 one two three")).toEqual([["halfwidth", "one"]])
    expect(alnum("**API**を使う")).toEqual([["halfwidth", "API"]])
    expect(alnum("日本語。。API")).toEqual([])
  })

  test("never counts an English sentence or a token far from Japanese", () => {
    expect(alnum("This is an English sentence... 日本語")).toEqual([])
    expect(alnum("日本語です。\nSee the guide at the end.")).toEqual([])
  })

  test("never counts inline code or a URL", () => {
    expect(alnum("入力`abc123`です")).toEqual([])
    expect(alnum("詳細はhttps://example.com/abcを参照")).toEqual([])
  })
})

describe("bracket_width occurrences", () => {
  test("reads a pair with Japanese inside by its width, spanning the pair", () => {
    expect(bracket("名前（日本語）と(日本語)")).toEqual([
      ["fullwidth", "（日本語）"],
      ["halfwidth", "(日本語)"],
    ])
  })

  test("never counts a pair without Japanese inside, such as an access key or a mark", () => {
    expect(bracket("開く(S) 商標(TM) (C) (R) （Ａ） (1)")).toEqual([])
  })

  test("never counts a pair that holds a parenthesis, nor one that is not closed alike", () => {
    expect(bracket("(日本(語))")).toEqual([["halfwidth", "(語)"]])
    expect(bracket("（日本(語)）")).toEqual([["halfwidth", "(語)"]])
    expect(bracket("（日本)(語）")).toEqual([])
  })

  test("never reads a pair across a line break, or a link target", () => {
    expect(bracket("(日本\n語)")).toEqual([])
    expect(bracket("[文書](https://example.com/日本語)")).toEqual([])
  })
})

describe("halfwidth_katakana", () => {
  test("reports each run, quoting it and its fullwidth form", () => {
    expect(hits("ﾃｽﾄとﾊﾞｰ")).toEqual([
      ["halfwidth_katakana", "ﾃｽﾄ"],
      ["halfwidth_katakana", "ﾊﾞｰ"],
    ])
    expect(reasons("ﾃｽﾄとﾊﾞｰ")).toEqual([
      'halfwidth katakana "ﾃｽﾄ"; the fullwidth form is "テスト"',
      'halfwidth katakana "ﾊﾞｰ"; the fullwidth form is "バー"',
    ])
  })

  test("quotes no more than twenty characters of a long run", () => {
    const [reason] = reasons("ｱ".repeat(40))
    expect(reason).toBe(`halfwidth katakana "${"ｱ".repeat(20)}…"; the fullwidth form is "${"ア".repeat(20)}…"`)
  })

  test("never reads inline code, and reads a heading and a list item", () => {
    expect(hits("入力`ﾃｽﾄ`出力")).toEqual([])
    expect(hits("# ﾃｽﾄ\n\n- ﾊﾞｰ")).toEqual([
      ["halfwidth_katakana", "ﾃｽﾄ"],
      ["halfwidth_katakana", "ﾊﾞｰ"],
    ])
  })
})

describe("the width rules as findings", () => {
  test("hold alnum_width to the text's majority, or to a given value", () => {
    const text = "2024年のＡＰＩは3つ、5つ"
    expect(hits(text)).toEqual([["alnum_width", "ＡＰＩ"]])
    expect(reasons(text)).toEqual(["fullwidth here; the text mostly uses halfwidth (3 to 1)"])
    expect(hits("２０２４年のＡＰＩ", { alnum_width: "halfwidth" })).toEqual([
      ["alnum_width", "２０２４"],
      ["alnum_width", "ＡＰＩ"],
    ])
  })

  test("hold bracket_width to the text's majority, or to a given value", () => {
    expect(hits("（日本語）と（英語）と(中国語)")).toEqual([["bracket_width", "(中国語)"]])
    expect(hits("（日本語）と（英語）", { bracket_width: "halfwidth" })).toEqual([
      ["bracket_width", "（日本語）"],
      ["bracket_width", "（英語）"],
    ])
  })

  test("draw nothing from a text that is consistent in either width", () => {
    expect(hits("（日本語）と（英語）、ＡＰＩとＳＤＫ")).toEqual([])
    expect(hits("(日本語)と(英語)、APIとSDK")).toEqual([])
  })
})
