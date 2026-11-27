import { describe, expect, test } from "bun:test"
import { reasons, revise } from "./revision.testing"

describe("the revision check, endings moved against the stance", () => {
  test("finds an ending moved to a request in an explanation, at the ending in both texts", async () => {
    const report = await revise("見出し\n\nログを確認します。", "見出し\n\nログを確認してください。", {
      stance: "explanation",
    })
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "stance_ending_moved",
        severity: "warn",
        line: 3,
        column: 7,
        original_line: 3,
        original_column: 6,
        excerpt: "見出し  ログを確認してください。",
        reason:
          'a request in an explanation: the sentence now ends in "てください"; the original\'s ending was not a request',
        reference: "revision.md#stance_ending_moved",
      },
    ])
  })

  test("runs only with a stance, and is not listed in not_run without one", async () => {
    const report = await revise("ログを確認します。", "ログを確認してください。")
    expect(report.findings).toEqual([])
    expect(report.not_run.map(({ rule }) => rule)).not.toContain("stance_ending_moved")
  })

  test("holds each stance to its own kinds of ending", async () => {
    const advice = await revise("ログの確認をおすすめします。", "ログの確認をします。", { stance: "advice" })
    expect(reasons(advice)).toEqual([
      [
        "stance_ending_moved",
        'an action in advice: the sentence now ends in "します"; the original\'s ending was not an action',
      ],
    ])
    const rule = await revise("ログの確認をします。", "ログの確認が重要です。", { stance: "rule" })
    expect(rule.findings.map(({ rule: id }) => id)).toEqual(["stance_ending_moved"])
    expect((await revise("ログの確認をします。", "ログの確認をします。", { stance: "rule" })).findings).toEqual([])
  })

  test("finds nothing when the original ended in the same kind", async () => {
    const report = await revise("ログを確認してください。", "ログを必ず確認してください。", { stance: "explanation" })
    expect(report.findings.map(({ rule }) => rule)).toEqual(["emphasis_changed"])
  })

  test("finds nothing when the revision moved it to a kind the stance allows", async () => {
    const report = await revise("ログを確認してください。", "ログを確認します。", { stance: "explanation" })
    expect(report.findings).toEqual([])
  })

  test("leaves an added sentence to `stance_ending` in `inspect`, and an unchanged one", async () => {
    const added = await revise("残る一文です。", "残る一文です。\n\nログを確認してください。", {
      stance: "explanation",
    })
    expect(added.findings).toEqual([])
    const text = "ログを確認してください。"
    expect((await revise(text, text, { stance: "explanation" })).findings).toEqual([])
  })

  test("places a sentence the original left without a terminator at its end", async () => {
    const report = await revise("ログを確認します", "ログを確認してください。", { stance: "explanation" })
    expect(report.findings[0]).toMatchObject({ rule: "stance_ending_moved", original_line: 1, original_column: 9 })
  })

  test("reads neither a heading nor a quotation", async () => {
    const report = await revise("# 確認します\n\n> 確認します。", "# 確認してください\n\n> 確認してください。", {
      stance: "explanation",
    })
    expect(report.findings).toEqual([])
  })

  test("is left out when exclude_rules names it", async () => {
    const report = await revise("ログを確認します。", "ログを確認してください。", {
      stance: "explanation",
      exclude_rules: ["stance_ending_moved"],
    })
    expect(report.findings).toEqual([])
  })
})
