import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { leadOf } from "./lead.words"
import { reasons, revise } from "./revision.testing"

/** The lead of one sentence, as the word. */
function leadWord(text: string): string | undefined {
  const doc = readDocument(text)
  const { start, end } = doc.sentences[0]
  return leadOf(doc, start, end)?.word
}

describe("leadOf", () => {
  test("reads a connective at the start, the longest first", () => {
    expect(leadWord("しかし、遅れました。")).toBe("しかし")
    expect(leadWord("しかしながら、遅れました。")).toBe("しかしながら")
    expect(leadWord("そのため、遅れました。")).toBe("そのため")
    expect(leadWord("ただし、遅れました。")).toBe("ただし")
    expect(leadWord("または、遅れました。")).toBe("または")
  })

  test("reads また, but not as the start of または or of a word", () => {
    expect(leadWord("また、遅れました。")).toBe("また")
    expect(leadWord("またその後に遅れました。")).toBe("また")
    expect(leadWord("またがる橋です。")).toBeUndefined()
  })

  test("reads a demonstrative before a particle, a kanji or a comma", () => {
    expect(leadWord("これは遅れました。")).toBe("これ")
    expect(leadWord("この方法は遅れました。")).toBe("この")
    expect(leadWord("そう考えると遅れました。")).toBe("そう")
    expect(leadWord("こうした遅れが出ました。")).toBe("こうした")
  })

  test("never reads a word that only starts like a lead", () => {
    expect(leadWord("それぞれが遅れました。")).toBeUndefined()
    expect(leadWord("今は遅れています。")).toBeUndefined()
    expect(leadWord("その他の遅れです。")).toBeUndefined()
    expect(leadWord("そうです。")).toBeUndefined()
    expect(leadWord("まずい結果です。")).toBeUndefined()
    expect(leadWord("ただの遅れです。")).toBeUndefined()
    expect(leadWord("一方的な遅れです。")).toBeUndefined()
    expect(leadWord("ところてんが遅れました。")).toBeUndefined()
  })

  test("reads a lead after an opening bracket, and 一方 with or without で", () => {
    expect(leadWord("「この方法は遅れた」と言う。")).toBe("この")
    expect(leadWord("一方で遅れました。")).toBe("一方")
    expect(leadWord("一方、遅れました。")).toBe("一方")
    expect(leadWord("では、始めます。")).toBe("では")
    expect(leadWord("では始めます。")).toBeUndefined()
  })

  test("gives the span of the lead in the text", () => {
    const doc = readDocument("「しかし、遅れた」と言う。")
    expect(leadOf(doc, 0, doc.text.length)).toEqual({ word: "しかし", start: 1, end: 4 })
  })

  test("never reads a masked unit", () => {
    expect(leadWord("`しかし` は遅れました。")).toBeUndefined()
    expect(leadWord("`foo` しかし遅れました。")).toBeUndefined()
  })
})

describe("the revision check, leads", () => {
  test("finds a lead changed to another, in the revision and at the original's lead", async () => {
    const report = await revise("見出し\n\nしかし、ログを確認します。", "見出し\n\nまた、ログを確認します。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "lead_changed",
        severity: "info",
        line: 3,
        column: 1,
        original_line: 3,
        original_column: 1,
        excerpt: "見出し  また、ログを確認します。",
        reason: 'The leading "しかし" was changed to "また"',
        reference: "revision.md#lead_changed",
      },
    ])
  })

  test("finds a lead added, with the original's sentence start as its place there", async () => {
    const report = await revise("ログを確認します。", "そのため、ログを確認します。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "lead_changed",
        severity: "info",
        line: 1,
        column: 1,
        original_line: 1,
        original_column: 1,
        excerpt: "そのため、ログを確認します。",
        reason: 'A leading "そのため" was added to this sentence',
        reference: "revision.md#lead_changed",
      },
    ])
  })

  test("finds a lead dropped at the revision's sentence, with the excerpt from the original", async () => {
    const report = await revise("見出し\n\nしかし、ログを確認します。", "見出し\n\nログを確認します。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "lead_changed",
        severity: "info",
        line: 3,
        column: 1,
        original_line: 3,
        original_column: 1,
        excerpt: "見出し  しかし、ログを確認します。",
        reason: 'The leading "しかし" was dropped from this sentence',
        reference: "revision.md#lead_changed",
      },
    ])
  })

  test("reads a demonstrative the same way", async () => {
    const report = await revise("この方法は安全です。", "その方法は安全です。")
    expect(reasons(report)).toEqual([["lead_changed", 'The leading "この" was changed to "その"']])
  })

  test("finds nothing when the lead is the same, though the sentence changed", async () => {
    const report = await revise("しかし、ログを確認します。", "しかし、ログを必ず確認します。")
    expect(report.findings.map(({ rule }) => rule)).toEqual(["emphasis_changed"])
  })

  test("reads 一方で and 一方、 as one lead", async () => {
    expect((await revise("一方で、ログを確認します。", "一方、ログを確認します。")).findings).toEqual([])
  })

  test("finds nothing for an unchanged sentence, one moved, or one with no pair", async () => {
    const text = "しかし、遅れました。"
    expect((await revise(text, text)).findings).toEqual([])
    const moved = await revise(
      "しかし、ログを確認します。\n\n設定を保存します。\n\n結果を報告します。",
      "設定を保存します。\n\n結果を報告します。\n\nまた、ログを確認します。",
    )
    expect(moved.findings).toEqual([])
    const added = await revise("残る一文です。", "残る一文です。\n\nしかし、全く別の話題です。")
    expect(added.findings).toEqual([])
  })

  test("never reads a sentence of a quotation", async () => {
    expect((await revise("> しかし、遅れた。", "> また、遅れた。")).findings).toEqual([])
  })

  test("is left out when exclude_rules names it", async () => {
    const report = await revise("しかし、ログを確認します。", "また、ログを確認します。", {
      exclude_rules: ["lead_changed"],
    })
    expect(report.findings).toEqual([])
  })
})
