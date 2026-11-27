import { describe, expect, test } from "bun:test"
import { hits, reasons } from "./notation.testing"

const only = (rule: string, text: string) => hits(text, { rules: [] }).filter(([id]) => id === rule)

describe("space_between_japanese", () => {
  test("reports spaces of either kind between two Japanese characters", () => {
    expect(only("space_between_japanese", "日本 語と日本　語と日本  語")).toEqual([
      ["space_between_japanese", " "],
      ["space_between_japanese", "\u3000"],
      ["space_between_japanese", "  "],
    ])
    expect(reasons("日本 語")).toEqual(["space between Japanese characters"])
    expect(reasons("日本　語")).toEqual(["ideographic space between Japanese characters"])
  })

  test("never reports an indent, a trailing space or a space beside Latin text", () => {
    expect(only("space_between_japanese", "　日本語\n日本語  \n日本語 Python\n語 、")).toEqual([])
  })

  test("never reads across a line break", () => {
    expect(only("space_between_japanese", "日本 \n 語")).toEqual([])
  })

  test("reads headings, list items and table cells", () => {
    expect(only("space_between_japanese", "# 日本 語\n\n- 日本 語\n\n| 日本 語 | x |\n|---|---|")).toHaveLength(3)
  })
})

describe("space_around_punctuation", () => {
  test("reports a space before a mark, and one after it when text follows", () => {
    expect(only("space_around_punctuation", "日本 、語。 本、　日本 ．")).toEqual([
      ["space_around_punctuation", " "],
      ["space_around_punctuation", " "],
      ["space_around_punctuation", "\u3000"],
      ["space_around_punctuation", " "],
    ])
    expect(reasons("日本 、語。 本")).toEqual(["space before punctuation", "space after punctuation"])
  })

  test("never reports the trailing spaces that make a Markdown hard break", () => {
    expect(only("space_around_punctuation", "日本語。  \n日本語。\u3000")).toEqual([])
  })

  test("reports one run once when it is both after and before a mark", () => {
    expect(only("space_around_punctuation", "日本、 。")).toHaveLength(1)
  })

  test("never reports a space beside ASCII punctuation", () => {
    expect(only("space_around_punctuation", "Hello , world. Next")).toEqual([])
  })
})

describe("space_inside_brackets", () => {
  test("reports a space after an opening bracket and before a closing one", () => {
    expect(only("space_inside_brackets", "「 日本語」と『日本語 』と（ 日本語 ）")).toEqual([
      ["space_inside_brackets", " "],
      ["space_inside_brackets", " "],
      ["space_inside_brackets", " "],
      ["space_inside_brackets", " "],
    ])
    expect(reasons("「 日本語 」")).toEqual(["space after an opening bracket", "space before a closing bracket"])
  })

  test("reads every opening and closing bracket of the list", () => {
    for (const [open, close] of ["「」", "『』", "（）", "【】", "〔〕", "〈〉", "《》"]) {
      expect(only("space_inside_brackets", `${open} 語 ${close}`)).toHaveLength(2)
    }
  })

  test("never reports a space outside a bracket, or the trailing spaces after an opening one", () => {
    expect(only("space_inside_brackets", "日本 「日本語」 日本\n「  ")).toEqual([])
  })
})

describe("the faults are warnings that a rule list can turn off", () => {
  test("exclude_rules names one fault and leaves the others", () => {
    const text = "日本 語ﾃｽﾄ"
    expect(hits(text).map(([rule]) => rule)).toEqual(["space_between_japanese", "halfwidth_katakana"])
    expect(hits(text, { exclude_rules: ["space_between_japanese"] }).map(([rule]) => rule)).toEqual([
      "halfwidth_katakana",
    ])
  })
})
