import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { findBoldPairs } from "./bold"
import { hits, reasons } from "./expression.testing"
import { readableLines } from "./lines"

/** What `bold_not_rendered` reports in a text: the matched pairs. */
function unrendered(text: string): string[] {
  return hits(text)
    .filter(([rule]) => rule === "bold_not_rendered")
    .map(([, matched]) => matched)
}

describe("bold_not_rendered", () => {
  test("reports a bracket inside the bold next to Japanese text", () => {
    expect(unrendered("次に**「文書の立場」**を決めます。")).toEqual(["**「文書の立場」**"])
    expect(unrendered("立場は**「勧め」か「決まり」**で決めます。")).toEqual(["**「勧め」か「決まり」**"])
  })

  test("reports a sentence mark that ends the bold before Japanese text", () => {
    expect(unrendered("これは**必須です。**詳しくは後述します。")).toEqual(["**必須です。**"])
  })

  test("reports a space inside the bold, on either side", () => {
    expect(unrendered("これは** 太字 **です")).toEqual(["** 太字 **"])
    expect(unrendered("これは** 太字**です")).toEqual(["** 太字**"])
    expect(unrendered("これは**太字 **です")).toEqual(["**太字 **"])
  })

  test("reads inline code beside the delimiter as the punctuation its backticks are", () => {
    expect(unrendered("a**`code`**b")).toEqual(["**`code`**"])
    expect(unrendered("a **`code`** b")).toEqual([])
  })

  test("reads a symbol outside the basic plane as one punctuation character", () => {
    expect(unrendered("完了**🎉**です")).toEqual(["**🎉**"])
    expect(unrendered("完了 **🎉** です")).toEqual([])
  })

  test("does not report bold that renders", () => {
    expect(unrendered("**語**を使います。")).toEqual([])
    expect(unrendered("これは**大事**な点です。")).toEqual([])
    expect(unrendered("次に「**文書の立場**」を決めます。")).toEqual([])
    expect(unrendered("**「語」** を使います。")).toEqual([])
    expect(unrendered("注意: **「語」** です。")).toEqual([])
  })

  test("takes the edges of a line as whitespace", () => {
    expect(unrendered("**「語」**")).toEqual([])
    expect(unrendered("- **「語」**")).toEqual([])
    expect(unrendered("**「語」**を使います。")).toEqual(["**「語」**"])
    expect(unrendered("を使う**「語」**")).toEqual(["**「語」**"])
  })

  test("pairs the delimiters of a line in order and leaves a stray one alone", () => {
    expect(unrendered("**語**と**「例」**を見る")).toEqual(["**「例」**"])
    expect(unrendered("未完の**強調")).toEqual([])
    expect(unrendered("**一**と**二**と**三")).toEqual([])
  })

  test("does not pair across lines", () => {
    expect(unrendered("**始まり\n終わり**")).toEqual([])
  })

  test("ignores a backslash-escaped delimiter and a run of another length", () => {
    expect(unrendered("次に\\*\\*「語」\\*\\*を見る")).toEqual([])
    expect(unrendered("次に\\**「語」**を見る")).toEqual([])
    expect(unrendered("次に*「語」*を見る")).toEqual([])
    expect(unrendered("次に***「語」***を見る")).toEqual([])
  })

  test("reads headings, list items and table cells, never code or a quotation", () => {
    expect(unrendered("## 見出し**「語」**です")).toEqual(["**「語」**"])
    expect(unrendered("- 項目**「語」**です")).toEqual(["**「語」**"])
    expect(unrendered("| 列 |\n| --- |\n| a**「語」**b |")).toEqual(["**「語」**"])
    expect(unrendered("コード `**「語」**` は対象外です。")).toEqual([])
    expect(unrendered("```\n次に**「語」**を見る\n```")).toEqual([])
    expect(unrendered("> 次に**「語」**を見る")).toEqual([])
  })

  test("says what to move, naming the side that fails", () => {
    expect(reasons("次に**「語」**を見る。")[0]).toBe(
      'the opening ** follows "に" and precedes "「", so it does not open bold; move "「" outside the bold, or put a space before **; ' +
        'the closing ** follows "」" and precedes "を", so it does not close bold; move "」" outside the bold, or put a space after **',
    )
    expect(reasons("これは** 太字**です。")[0]).toBe(
      "the opening ** is followed by a space or the end of the line, so it does not open bold; remove the space",
    )
    expect(reasons("これは**太字 **です。")[0]).toContain("the closing ** is preceded by a space")
  })
})

describe("findBoldPairs", () => {
  function flanks(text: string): [boolean, boolean][] {
    const doc = readDocument(text)
    return findBoldPairs(doc, readableLines(doc)).map(({ opens, closes }) => [opens, closes])
  }

  test("tells whether each delimiter of a pair can open and close", () => {
    expect(flanks("a**b**c")).toEqual([[true, true]])
    expect(flanks("a**「b」**c")).toEqual([[false, false]])
    expect(flanks("a**「b」** c")).toEqual([[false, true]])
    expect(flanks("a **「b」**c")).toEqual([[true, false]])
  })
})
