import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { MAX_EXCERPT } from "../limits"
import { outlineOf } from "./outline"

const outline = (...lines: string[]) => outlineOf(readDocument(lines.join("\n")))

const FIXTURE = [
  "前置きだ。",
  "",
  "# 概要",
  "本文です。",
  "> 引用の文",
  "",
  "## 詳細 ##",
  "- **強調**",
  "- 普通の項目",
  "",
  "```",
  "コードの中身",
  "```",
  "",
  "Setext 見出し",
  "===",
  "末尾の本文。",
]

describe("the outline's headings", () => {
  test("lists ATX and setext headings in order with their levels, places and section sizes", () => {
    expect(outline(...FIXTURE).headings).toEqual([
      { level: 1, line: 3, column: 3, text: "概要", chars: 5 },
      { level: 2, line: 7, column: 4, text: "詳細", chars: 11 },
      { level: 1, line: 15, column: 1, text: "Setext 見出し", chars: 6 },
    ])
  })

  test("ends a section at the next heading of any level, and leaves the text before the first one out", () => {
    const { headings, measures } = outline("前置き", "# 一", "あい", "### 二", "うえお", "# 三")
    expect(headings.map(({ level, chars }) => [level, chars])).toEqual([
      [1, 2],
      [3, 3],
      [1, 0],
    ])
    expect(measures.chars).toBe(3 + 1 + 2 + 1 + 3 + 1)
  })

  test("counts neither quotations nor fenced code in a section", () => {
    const { headings } = outline("# 見出し", "> 引用", "", "```", "code", "```", "    indented", "", "本文")
    expect(headings[0].chars).toBe(2)
  })

  test("counts as readableChars does: spaces not at all, each unit of inline code as one character", () => {
    const { headings } = outline("# 見出し", "`ab` と  c")
    expect(headings[0].chars).toBe(4 + 1 + 1)
  })

  test("shows the text without markers or closing hashes, as written", () => {
    const { headings } = outline("###   `config` の設定   ###", "本文")
    expect(headings[0]).toMatchObject({ level: 3, column: 7, text: "`config` の設定" })
  })

  test("lists a heading with no text, and does not list a heading inside a quotation or a code block", () => {
    const { headings } = outline("#", "> # 引用の見出し", "```", "# コメント", "```")
    expect(headings).toEqual([{ level: 1, line: 1, column: 2, text: "", chars: 0 }])
  })

  test("clips a long heading to an excerpt", () => {
    const [heading] = outline(`# ${"あ".repeat(120)}`).headings
    expect([...heading.text]).toHaveLength(MAX_EXCERPT)
    expect(heading.text.endsWith("…")).toBe(true)
  })

  test("lists nothing for a text without headings", () => {
    expect(outline("ただの文。").headings).toEqual([])
    expect(outline("").headings).toEqual([])
  })
})

describe("the outline's measures", () => {
  test("count the readable lines, their characters and the bold, list and heading lines among them", () => {
    expect(outline(...FIXTURE).measures).toEqual({
      lines: 8,
      chars: 40,
      bold_lines: 1,
      list_lines: 2,
      heading_lines: 3,
      bold_spans: 1,
      bold_share: 0.125,
      list_share: 0.25,
      heading_share: 0.375,
      bold_per_thousand: 25,
    })
  })

  test("round the shares to 3 decimals and the bold rate to 2", () => {
    const { measures } = outline("**あ**", "う", "- え")
    expect(measures).toMatchObject({ lines: 3, bold_lines: 1, bold_share: 0.333, list_share: 0.333 })
    expect(measures.bold_per_thousand).toBe(142.86)
  })

  test("count a bold pair that does not render for nothing, as bold_density does", () => {
    const { measures } = outline("** あ** い", "うえ")
    expect(measures).toMatchObject({ bold_lines: 0, bold_spans: 0, bold_per_thousand: 0 })
  })

  test("count several bold spans of one line once as a line and each as a span", () => {
    const { measures } = outline("**あ**と**い**", "う")
    expect(measures).toMatchObject({ lines: 2, bold_lines: 1, bold_spans: 2 })
  })

  test("are all 0 when the text has no readable line", () => {
    for (const text of ["", "\n\n", "```\ncode\n```", "> 引用だけ"]) {
      expect(outline(text).measures).toEqual({
        lines: 0,
        chars: 0,
        bold_lines: 0,
        list_lines: 0,
        heading_lines: 0,
        bold_spans: 0,
        bold_share: 0,
        list_share: 0,
        heading_share: 0,
        bold_per_thousand: 0,
      })
    }
  })

  test("read table rows as readable lines, and skip blank list items", () => {
    const { measures } = outline("| あ | い |", "| --- | --- |", "| う | え |", "-")
    expect(measures).toMatchObject({ lines: 2, list_lines: 0 })
  })
})
