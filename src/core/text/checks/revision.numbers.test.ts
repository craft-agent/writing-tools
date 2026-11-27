import { describe, expect, test } from "bun:test"
import { reasons, revise } from "./revision.testing"

describe("the revision check, numbers", () => {
  test("finds nothing in a text compared with itself or in an unchanged text", async () => {
    const text = "価格は30円です。\n\n2026年11月27日に三千五百万円を払う。"
    expect((await revise(text, text)).findings).toEqual([])
    expect((await revise(text, text)).counts.total).toBe(0)
  })

  test("finds a number the revision lost and one it added, each with its places", async () => {
    const report = await revise("見出し\n\n価格は30円です。", "見出し\n\n価格は20円です。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "number_lost",
        severity: "critical",
        line: 3,
        column: 1,
        original_line: 3,
        original_column: 4,
        excerpt: "見出し  価格は30円です。",
        reason: '"30" is in the original but not in the revision',
        reference: "revision.md#number_lost",
      },
      {
        check: "revision",
        rule: "number_added",
        severity: "warn",
        line: 3,
        column: 4,
        excerpt: "見出し  価格は20円です。",
        reason: '"20" is in the revision but not in the original',
        reference: "revision.md#number_added",
      },
    ])
  })

  test("places what was lost at the start of the sentence paired with the original's", async () => {
    const report = await revise(
      "前置きです。\n\n送料は500円です。\n\n終わりです。",
      "前置きです。\n\n送料は無料です。\n\n終わりです。",
    )
    const lost = report.findings.find(({ rule }) => rule === "number_lost")
    expect(lost).toMatchObject({ line: 3, column: 1, original_line: 3, original_column: 4 })
  })

  test("places what was lost with the next sentence that has a pair when its sentence was dropped, and at the end when none follows", async () => {
    const dropped = await revise(
      "残る一文です。\n\n消えた文は30件です。\n\n次の一文です。",
      "残る一文です。\n\n次の一文です。",
    )
    expect(dropped.findings).toHaveLength(1)
    expect(dropped.findings[0]).toMatchObject({ rule: "number_lost", line: 3, column: 1, original_line: 3 })
    const last = await revise("残る一文です。\n\n最後の文は30件です。", "残る一文です。")
    expect(last.findings[0]).toMatchObject({ rule: "number_lost", line: 1, column: 8, original_line: 3 })
  })

  test("reports the excerpt from the original for what was lost and from the revision for what was added", async () => {
    const report = await revise("元の文は30個です。", "新しい文は20個です。")
    const [lost, added] = report.findings
    expect(lost.excerpt).toContain("元の文は30個")
    expect(added.excerpt).toContain("新しい文は20個")
  })

  test("reads a number as its value, so a width, grouping or a unit of ten thousand is no change", async () => {
    expect((await revise("1,000円と3万円。", "１０００円と30,000円。")).findings).toEqual([])
    expect((await revise("三千五百万円です。", "35,000,000円です。")).findings).toEqual([])
  })

  test("names how a lost number was written when that differs from its value", async () => {
    const report = await revise("予算は三千五百万円です。", "予算は未定です。")
    expect(reasons(report)).toEqual([
      ["number_lost", '"35000000" (written 三千五百万) is in the original but not in the revision'],
    ])
  })

  test("finds nothing when a sentence only moved", async () => {
    const report = await revise(
      "一つ目は10件です。\n\n二つ目は20件です。\n\n三つ目です。",
      "二つ目は20件です。\n\n三つ目です。\n\n一つ目は10件です。",
    )
    expect(report.findings).toEqual([])
  })

  test("counts a number over the whole text, one finding for each use it has fewer or more of", async () => {
    const fewer = await revise("価格は30円です。\n\n送料は30円です。", "価格は30円です。\n\n送料は無料です。")
    expect(reasons(fewer)).toEqual([["number_lost", '"30" is in the original but not in the revision']])
    expect(fewer.findings[0]).toMatchObject({ original_line: 3 })
    const more = await revise("価格は30円です。", "価格は30円です。送料は30円です。送料込みで30円です。")
    expect(more.findings.map(({ rule }) => rule)).toEqual(["number_added", "number_added"])
  })

  test("blames the use in a sentence that changed or was dropped before one that is unchanged", async () => {
    const report = await revise(
      "30は変わらない数です。\n\nここで30を使う。",
      "30は変わらない数です。\n\nここで別の数を使う。",
    )
    expect(report.findings[0]).toMatchObject({ rule: "number_lost", original_line: 3 })
  })

  test("reads a date as its numbers, so a changed day is one lost and one added", async () => {
    const report = await revise("2026年11月27日に会う。", "2026年11月28日に会う。")
    expect(reasons(report)).toEqual([
      ["number_lost", '"27" is in the original but not in the revision'],
      ["number_added", '"28" is in the revision but not in the original'],
    ])
  })

  test("never reads a kanji numeral in a word such as 一般 or 統一", async () => {
    expect((await revise("一般に統一する。", "広く揃える。")).findings).toEqual([])
  })

  test("never reads masked text or a quotation", async () => {
    expect((await revise("`30` を使う。\n\n> 50円", "`20` を使う。\n\n> 60円")).findings).toEqual([])
  })

  test("is left out when exclude_rules names it", async () => {
    const report = await revise("価格は30円です。", "価格は20円です。", { exclude_rules: ["number_lost"] })
    expect(report.findings.map(({ rule }) => rule)).toEqual(["number_added"])
  })
})
