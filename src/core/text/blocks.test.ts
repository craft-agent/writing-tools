import { describe, expect, test } from "bun:test"
import { readDocument } from "./document"
import { kinds, masksOf } from "./document.testing"

const BLOCK_SCOPES = [
  "---",
  "# FRONT **bold** API",
  "...",
  "   ````python",
  "# CODE **bold** API",
  "```",
  "~~~~",
  "```` not closing",
  "   `````",
  "<!--",
  "# COMMENT **bold** API",
  "-->",
  "> # QUOTE **bold** API",
  "lazy QUOTE **bold** API",
  "",
  "    # INDENT **bold** API",
  "",
  "Header | API",
  "--- | ---",
  "**TABLE** | API",
  "",
  "# まとめ API",
  "",
  "タイトル API",
  "===",
  "",
  "- リスト API **one**",
  "  続き API **two**",
  "",
  "  続き API",
  "",
  "本文 API **three**。",
].join("\n")

function contents(text: string): string[] {
  const doc = readDocument(text)
  return doc.lines.map((line) => text.slice(line.contentStart, line.contentEnd))
}

describe("line kinds", () => {
  test("keep front matter, code, comments, quotes, tables, headings and lists apart", () => {
    expect(kinds(BLOCK_SCOPES)).toEqual([
      ...Array<string>(12).fill("excluded"),
      "quote",
      "quote",
      "excluded",
      "excluded",
      "excluded",
      "table",
      "excluded",
      "table",
      "excluded",
      "heading",
      "excluded",
      "heading",
      "excluded",
      "excluded",
      "list",
      "list",
      "excluded",
      "list",
      "excluded",
      "prose",
    ])
  })

  test("take front matter only when it closes", () => {
    expect(kinds("---\ntitle: x\n---\n本文")).toEqual(["excluded", "excluded", "excluded", "prose"])
    expect(kinds("---\n本文")).toEqual(["excluded", "prose"])
    expect(masksOf("---\n本文")).toEqual([])
  })

  test("read ATX headings with their level and without closing hashes", () => {
    const text = "# 見出し\n\n## まとめ ##\n\n### C#\n\n#hashtag"
    const doc = readDocument(text)
    expect(doc.lines.filter((line) => line.kind === "heading").map((line) => line.level)).toEqual([1, 2, 3])
    expect(contents(text)).toEqual(["見出し", "", "まとめ", "", "C#", "", "#hashtag"])
    expect(doc.lines[6].kind).toBe("prose")
  })

  test("read setext headings and tell `---` apart from a thematic break", () => {
    const doc = readDocument("API\n-\n\nタイトル\n===\n\n本文\n\n---\n\n本文")
    expect(doc.lines.map((line) => [line.kind, line.level])).toEqual([
      ["heading", 2],
      ["excluded", undefined],
      ["excluded", undefined],
      ["heading", 1],
      ["excluded", undefined],
      ["excluded", undefined],
      ["prose", undefined],
      ["excluded", undefined],
      ["excluded", undefined],
      ["excluded", undefined],
      ["prose", undefined],
    ])
    expect(kinds("***\n___\n- - -\n  ---  ")).toEqual(["excluded", "excluded", "excluded", "excluded"])
  })

  test("skip the markers of list items and count a task box in the content start", () => {
    expect(contents("- 項目\n* [ ] 未了\n+ [x] 済み\n1. 番号\n10) 括弧\n-\n- [ ]")).toEqual([
      "項目",
      "未了",
      "済み",
      "番号",
      "括弧",
      "",
      "",
    ])
    expect(kinds("-項目\n*強調*\n**強調**")).toEqual(["prose", "prose", "prose"])
  })

  test("continue a list item by indentation or lazily, and end it after a blank line", () => {
    expect(kinds("- 項目\n  続き\n継続行\n\n本文")).toEqual(["list", "list", "list", "excluded", "prose"])
    expect(kinds("- 項目\n\n  段落\n続き\n\n本文")).toEqual(["list", "excluded", "list", "list", "excluded", "prose"])
  })

  test("treat code inside a list item as code, indented or fenced", () => {
    expect(kinds("- item\n\n      CODE\n\n  続き")).toEqual(["list", "excluded", "excluded", "excluded", "list"])
    const text = "- ````python\n  # FAKE **bold**\n  ```\n  ````\n\nAPI"
    expect(kinds(text)).toEqual(["excluded", "excluded", "excluded", "excluded", "excluded", "prose"])
    expect(masksOf(text)).toEqual([["code_block", "````python\n  # FAKE **bold**\n  ```\n  ````"]])
  })

  test("end a fence only with a closer of the same character and at least its length", () => {
    const text = "````\n```\n~~~~\n````\n本文"
    expect(kinds(text)).toEqual(["excluded", "excluded", "excluded", "excluded", "prose"])
    expect(kinds("```a`b\n本文")).toEqual(["prose", "prose"])
    expect(masksOf("~~~\nopen")).toEqual([["code_block", "~~~\nopen"]])
  })

  test("take indented code outside a list but not an indented continuation of an item", () => {
    expect(kinds("    code\n\t\ttab\n\n本文")).toEqual(["excluded", "excluded", "excluded", "prose"])
    expect(kinds("- 項目\n\n    続き")).toEqual(["list", "excluded", "list"])
  })

  test("take a quotation with lazy continuation until a blank line", () => {
    const text = "> 引用\n> > 入れ子\n続き\n>\n> 次\n\n本文"
    expect(kinds(text)).toEqual(["quote", "quote", "quote", "excluded", "quote", "excluded", "prose"])
    expect(contents(text).filter((content, index) => kinds(text)[index] === "quote")).toEqual([
      "引用",
      "入れ子",
      "続き",
      "次",
    ])
    expect(kinds("> 引用\n# 見出し\n- 項目")).toEqual(["quote", "heading", "list"])
  })

  test("take a table with its delimiter row excluded and its rows after it", () => {
    expect(kinds("| a | b |\n| --- | :---: |\n| 1 | 2 |\n| 3 | 4 |\n本文")).toEqual([
      "table",
      "excluded",
      "table",
      "table",
      "prose",
    ])
    expect(kinds("| a |\n|---|\n| 1 |")).toEqual(["table", "excluded", "table"])
    expect(kinds("a | b\n--- | ---\nc | d")).toEqual(["table", "excluded", "table"])
    expect(kinds("a | b\n---\n")).toEqual(["heading", "excluded", "excluded"])
    expect(kinds("a\n| --- | --- |")).toEqual(["prose", "prose"])
  })

  test("exclude reference definitions but not footnote definitions", () => {
    expect(kinds("[ref]: https://example.com\n[^1]: 脚注")).toEqual(["excluded", "prose"])
    expect(masksOf("[ref]: https://example.com")).toEqual([["link_target", "[ref]: https://example.com"]])
  })

  test("read a text that ends with a line break as one more empty line", () => {
    expect(kinds("本文\n")).toEqual(["prose", "excluded"])
    expect(kinds("")).toEqual(["excluded"])
  })
})

describe("blocks", () => {
  const blockLines = (text: string): [string, number[]][] =>
    readDocument(text).blocks.map((block) => [block.kind, [...block.lines]])

  test("join the prose lines of a paragraph and split paragraphs at a blank line", () => {
    expect(blockLines("一行目\n二行目\n\n三行目")).toEqual([
      ["prose", [1, 2]],
      ["prose", [4]],
    ])
  })

  test("end a paragraph at a heading, a list item, a table, a quotation or code", () => {
    const text = "本文\n# 見出し\n本文\n- 項目\n本文\n\n> 引用\n\n本文\n```\ncode\n```\n本文"
    expect(blockLines(text)).toEqual([
      ["prose", [1]],
      ["heading", [2]],
      ["prose", [3]],
      ["list", [4, 5]],
      ["quote", [7]],
      ["prose", [9]],
      ["prose", [13]],
    ])
  })

  test("make a block of each list item with its continuation lines, and one of each heading and table row", () => {
    const text = "- 一\n  続き\n- 二\n\n  段落\n\n| a |\n| --- |\n| 1 |\n| 2 |\n\n# 見出し\n## 見出し"
    expect(blockLines(text)).toEqual([
      ["list", [1, 2]],
      ["list", [3]],
      ["list", [5]],
      ["table", [7]],
      ["table", [9]],
      ["table", [10]],
      ["heading", [12]],
      ["heading", [13]],
    ])
  })

  test("end a block at a quoted blank line and take consecutive quote lines as one", () => {
    expect(blockLines("> 一\n> 二\n>\n> 三")).toEqual([
      ["quote", [1, 2]],
      ["quote", [4]],
    ])
  })

  test("reach from the first line's content start to the last line's content end", () => {
    const text = "- 項目\n  続き  \n"
    const [block] = readDocument(text).blocks
    expect(text.slice(block.start, block.end)).toBe("項目\n  続き  ")
  })
})
