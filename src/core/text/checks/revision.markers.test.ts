import { describe, expect, test } from "bun:test"
import { reasons, revise } from "./revision.testing"

describe("the revision check, markers", () => {
  test("finds a marker the revision dropped, placed at the revision's sentence with its own place and excerpt in the original", async () => {
    const report = await revise("見出し\n\nログを確認すべきです。", "見出し\n\nログを確認します。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "obligation_changed",
        severity: "warn",
        line: 3,
        column: 1,
        original_line: 3,
        original_column: 7,
        excerpt: "見出し  ログを確認すべきです。",
        reason: '"べきです" (obligation) was dropped from this sentence',
        reference: "revision.md#obligation_changed",
      },
    ])
  })

  test("finds a marker the revision added at the marker, with no place in the original", async () => {
    const report = await revise("ログを確認します。", "ログを確認すべきです。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "obligation_changed",
        severity: "warn",
        line: 1,
        column: 7,
        excerpt: "ログを確認すべきです。",
        reason: '"べきです" (obligation) was added to this sentence',
        reference: "revision.md#obligation_changed",
      },
    ])
  })

  test("reads each kind on its own, with its own rule", async () => {
    const report = await revise("設定ファイルの内容を確認すべきです。", "設定ファイルの内容を必ず確認します。")
    expect(reasons(report)).toEqual([
      ["obligation_changed", '"べきです" (obligation) was dropped from this sentence'],
      ["emphasis_changed", '"必ず" (emphasis) was added to this sentence'],
    ])
    const guess = await revise("設定ファイルの内容を確認します。", "設定ファイルの内容を確認するかもしれません。")
    expect(guess.findings.map(({ rule }) => rule)).toEqual(["conjecture_changed"])
  })

  test("counts one marker dropped in one sentence and another added in another as two findings", async () => {
    const report = await revise(
      "ログを確認すべきです。\n\n設定を保存します。",
      "ログを確認します。\n\n設定を保存すべきです。",
    )
    expect(reasons(report)).toEqual([
      ["obligation_changed", '"べきです" (obligation) was dropped from this sentence'],
      ["obligation_changed", '"べきです" (obligation) was added to this sentence'],
    ])
  })

  test("finds nothing when a kind changes its wording and keeps its count", async () => {
    const report = await revise(
      "設定ファイルの内容を必ず確認すべきです。",
      "設定ファイルの内容を必ず確認しなければなりません。",
    )
    expect(report.findings).toEqual([])
  })

  test("reports one finding for each marker of a kind that is fewer or more", async () => {
    const fewer = await revise("ログは必ず確認し、設定も必ず確認します。", "ログは必ず確認し、設定も確認します。")
    expect(reasons(fewer)).toEqual([["emphasis_changed", '"必ず" (emphasis) was dropped from this sentence']])
    expect(fewer.findings[0]).toMatchObject({ original_column: 13 })
    const more = await revise("ログを確認します。", "ログは必ず確認し、非常に丁寧に確認します。")
    expect(more.findings.map(({ rule }) => rule)).toEqual(["emphasis_changed", "emphasis_changed"])
  })

  test("names the marker that is not in the other sentence when a kind has more", async () => {
    const report = await revise("ログは必ず確認し、非常に丁寧に見ます。", "ログは必ず確認し、丁寧に見ます。")
    expect(reasons(report)).toEqual([["emphasis_changed", '"非常に" (emphasis) was dropped from this sentence']])
  })

  test("counts every marker of a sentence with no pair, dropped from the original or added to the revision", async () => {
    const dropped = await revise("残る一文です。\n\n全く別の話題で、絶対に守るべきです。", "残る一文です。")
    expect(
      dropped.findings.map(({ rule, line, column, original_line }) => [rule, line, column, original_line]),
    ).toEqual([
      ["emphasis_changed", 1, 8, 3],
      ["obligation_changed", 1, 8, 3],
    ])
    const added = await revise("残る一文です。", "残る一文です。\n\n全く別の話題で、おそらく雨でしょう。")
    expect(added.findings.map(({ rule, line, original_line }) => [rule, line, original_line])).toEqual([
      ["conjecture_changed", 3, undefined],
      ["conjecture_changed", 3, undefined],
    ])
  })

  test("finds nothing when a sentence only moved, though it has no pair", async () => {
    const report = await revise(
      "ログを確認すべきです。\n\n設定を保存します。\n\n結果を報告します。",
      "設定を保存します。\n\n結果を報告します。\n\nログを確認すべきです。",
    )
    expect(report.findings).toEqual([])
  })

  test("finds nothing in an unchanged text or in one only wrapped elsewhere", async () => {
    const text = "必ず確認すべきです。おそらく届くでしょう。"
    expect((await revise(text, text)).findings).toEqual([])
    expect((await revise("必ず確認す\nべきです。", "必ず確認すべき\nです。")).findings).toEqual([])
  })

  test("never reads a word that only contains a marker", async () => {
    const report = await revise("必要な機能をはずす。", "機能をはずす。\n\nまたは、絶対値を使う。")
    expect(report.findings).toEqual([])
  })

  test("never reads masked text or a quotation", async () => {
    expect((await revise("`べきです` と書く。\n\n> 必ず", "と書く。\n\n> おそらく")).findings).toEqual([])
  })

  test("is left out, a kind at a time, when exclude_rules names it", async () => {
    const report = await revise("設定ファイルの内容を確認すべきです。", "設定ファイルの内容を必ず確認します。", {
      exclude_rules: ["emphasis_changed"],
    })
    expect(report.findings.map(({ rule }) => rule)).toEqual(["obligation_changed"])
  })
})
