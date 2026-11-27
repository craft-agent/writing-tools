import { describe, expect, test } from "bun:test"
import { hits, run } from "./notation.testing"

const MIXED = "日本語 Python を使う、そして。\n日本語 Ruby を使う。\n日本語Go を使う。"

describe("the text the notation check reads", () => {
  test("reads prose, headings, list items and table cells", () => {
    for (const line of ["日本語Python", "# 日本語Python", "- 日本語Python", "1. 日本語Python", "| 日本語Python |"]) {
      const text = `${line}\n`
      expect(hits(text, { latin_spacing: "spaced" }), line).toEqual([["latin_spacing", "語P"]])
    }
  })

  test("never reads a quotation, a code block, front matter, a comment or an HTML tag", () => {
    const texts = [
      "> 日本語Python",
      "```\n日本語Python\n```",
      "    日本語Python",
      "---\ntitle: 日本語Python\n---\n",
      "<!-- 日本語Python -->",
      "日本語<b>Python</b>",
    ]
    for (const text of texts) expect(hits(text, { latin_spacing: "spaced" }), text).toEqual([])
  })

  test("reads a list item inside a quotation as the quotation's", () => {
    expect(hits("> - 日本語Python", { latin_spacing: "spaced" })).toEqual([])
  })

  test("counts only what it reads towards a majority", () => {
    const text = "日本語 Python\n日本語 Ruby\n\n> 日本語Go\n> 日本語Rust\n\n日本語Perl"
    expect(hits(text)).toEqual([["latin_spacing", "語P"]])
  })
})

describe("a convention rule that is off", () => {
  test("is neither checked nor settled, while the others still are", () => {
    const result = run(MIXED, { exclude_rules: ["latin_spacing"] })
    expect(result.findings).toEqual([])
    expect(result.settled).toEqual({ alnum_width: "halfwidth", punctuation: "ten_maru" })
    expect(run(MIXED).settled).toMatchObject({ latin_spacing: "spaced" })
  })

  test("a given value is not checked either", () => {
    expect(hits(MIXED, { latin_spacing: "unspaced", exclude_rules: ["latin_spacing"] })).toEqual([])
  })
})

describe("what the check settles", () => {
  test("is the majority of each convention the text uses, and nothing for one it never uses", () => {
    expect(run(MIXED).settled).toEqual({
      latin_spacing: "spaced",
      alnum_width: "halfwidth",
      punctuation: "ten_maru",
    })
    expect(run("あ").settled).toBeUndefined()
  })

  test("leaves out a convention that was given a value", () => {
    expect(run(MIXED, { latin_spacing: "spaced" }, { punctuation: "ten_maru" }).settled).toEqual({
      alnum_width: "halfwidth",
    })
  })
})
