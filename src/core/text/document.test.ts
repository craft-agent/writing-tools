import { describe, expect, test } from "bun:test"
import { locate, readDocument } from "./document"
import { MASK_CHAR } from "./model"

const MIXED = [
  "---",
  "title: x",
  "---",
  "",
  "# 見出し `code` と [リンク](https://example.com/a(b))",
  "",
  "本文 <!-- 注",
  "釈 --> https://example.com/x、\\*終わり。",
  "",
  "```js",
  "const a = 1",
  "```",
  "",
  "- 項目 ![画像](a.png)",
  "",
  "[ref]: https://example.com",
].join("\n")

describe("the masked text", () => {
  test("keeps the length of the text and every line break", () => {
    for (const text of [
      MIXED,
      MIXED.replaceAll("\n", "\r\n"),
      MIXED.replaceAll("\n", "\r"),
      "",
      "`a\nb`",
      "<!--\n-->",
    ]) {
      const doc = readDocument(text)
      expect(doc.masked).toHaveLength(text.length)
      expect(doc.masked.replace(/[^\r\n]/g, "")).toBe(text.replace(/[^\r\n]/g, ""))
    }
  })

  test("replaces exactly the masked units, and nothing else", () => {
    const doc = readDocument(MIXED)
    const covered = new Set<number>()
    for (const mask of doc.masks) for (let at = mask.start; at < mask.end; at++) covered.add(at)
    for (let at = 0; at < MIXED.length; at++) {
      const lineBreak = MIXED[at] === "\n"
      expect(doc.masked[at] === MASK_CHAR).toBe(covered.has(at) && !lineBreak)
      if (!covered.has(at) || lineBreak) expect(doc.masked[at]).toBe(MIXED[at])
    }
  })

  test("masks both units of a character outside the BMP", () => {
    const doc = readDocument("𠮷 `𠮷` 𠮷")
    expect(doc.masked).toBe(`𠮷 ${MASK_CHAR.repeat(4)} 𠮷`)
  })

  test("lists non-overlapping masks in order", () => {
    const { masks } = readDocument(MIXED)
    expect(masks.length).toBeGreaterThan(5)
    masks.forEach((mask, index) => {
      expect(mask.end).toBeGreaterThan(mask.start)
      if (index > 0) expect(mask.start).toBeGreaterThanOrEqual(masks[index - 1].end)
    })
  })
})

describe("offsets", () => {
  test("split lines on CRLF, CR and LF, and point into the text as given", () => {
    const text = "一行目\r\n二行目\r三行目\n四行目"
    const doc = readDocument(text)
    expect(doc.lines.map((line) => text.slice(line.start, line.end))).toEqual(["一行目", "二行目", "三行目", "四行目"])
    expect(doc.lines.map((line) => line.number)).toEqual([1, 2, 3, 4])
    expect(doc.sentences.map((sentence) => text.slice(sentence.start, sentence.end))).toEqual([
      "一行目\r\n二行目\r三行目\n四行目",
    ])
  })

  test("keep a CRLF text's sentences and masks pointing at the same text", () => {
    const text = MIXED.replaceAll("\n", "\r\n")
    const doc = readDocument(text)
    expect(doc.masks.map((mask) => text.slice(mask.start, mask.end))).toEqual(
      readDocument(MIXED).masks.map((mask) => MIXED.slice(mask.start, mask.end).replaceAll("\n", "\r\n")),
    )
    expect(doc.sentences.map((sentence) => text.slice(sentence.start, sentence.end))).toEqual(
      readDocument(MIXED).sentences.map((sentence) =>
        MIXED.slice(sentence.start, sentence.end).replaceAll("\n", "\r\n"),
      ),
    )
  })

  test("reads a 128 KiB text in well under a second", () => {
    const paragraph = "これは `code` を含む文です。[リンク](https://example.com/a(b)) と https://example.com も。\n"
    const text = paragraph.repeat(Math.ceil((128 * 1024) / paragraph.length))
    const started = performance.now()
    const doc = readDocument(text)
    expect(performance.now() - started).toBeLessThan(1000)
    expect(doc.sentences.length).toBeGreaterThan(1000)
  })

  test("reads a long line of unmatched backticks and brackets without slowing down", () => {
    const text = "`` ` ``` ` ```` ] ]( [ ][ <a ".repeat(4000)
    const started = performance.now()
    readDocument(text)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

describe("locate", () => {
  const doc = readDocument("一行目\r\n𠮷野家\n\n末尾")

  test("gives a 1-based line and a 1-based column", () => {
    expect(locate(doc, 0)).toEqual({ line: 1, column: 1 })
    expect(locate(doc, 2)).toEqual({ line: 1, column: 3 })
    expect(locate(doc, 5)).toEqual({ line: 2, column: 1 })
  })

  test("counts a character outside the BMP as one column", () => {
    expect(locate(doc, 7)).toEqual({ line: 2, column: 2 })
    expect(locate(doc, 8)).toEqual({ line: 2, column: 3 })
    expect(locate(doc, 6)).toEqual({ line: 2, column: 2 })
  })

  test("puts a line break on the line it ends, an empty line at its start, and the end on the last line", () => {
    expect(locate(doc, 3)).toEqual({ line: 1, column: 4 })
    expect(locate(doc, 10)).toEqual({ line: 3, column: 1 })
    expect(locate(doc, 11)).toEqual({ line: 4, column: 1 })
    expect(locate(doc, doc.text.length)).toEqual({ line: 4, column: 3 })
  })

  test("clamps an offset outside the text", () => {
    expect(locate(doc, -5)).toEqual({ line: 1, column: 1 })
    expect(locate(doc, 999)).toEqual({ line: 4, column: 3 })
  })

  test("works on an empty text", () => {
    expect(locate(readDocument(""), 0)).toEqual({ line: 1, column: 1 })
  })
})
