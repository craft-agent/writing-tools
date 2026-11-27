import { describe, expect, test } from "bun:test"
import { invoke } from "../../tool"
import { writingTextRead } from "../read"

const CTX = { cwd: process.cwd() }

/** The rhythm rules this text also draws, left out so the tests read the convention rules alone. */
const RHYTHM_RULES = ["choppy_sentences", "ending_repetition"]

const TEXT = [
  "# 作業の手順",
  "",
  "3〜5日で「確認」します。サーバーを使います。",
  "6～7日の“停止”を、ユーザーに伝えます。",
  "メモリーを3か月ごとに見ます。ブラウザは使いません。",
  "2ヶ月後に停止する。",
].join("\n")

describe("writing_text_read with the convention rules of both checks", () => {
  test("reports each minority with its reference, and the conventions the text settled", async () => {
    const report = await invoke(writingTextRead, { method: "inspect", text: TEXT, exclude_rules: RHYTHM_RULES }, CTX)
    expect(report.findings.map(({ rule, line, column, reference }) => [rule, line, column, reference])).toEqual([
      ["range_mark", 4, 2, "notation.md#range_mark"],
      ["quotes", 4, 6, "notation.md#quotes"],
      ["long_vowel", 5, 16, "notation.md#long_vowel"],
      ["counter_ka", 6, 2, "notation.md#counter_ka"],
      ["register", 6, 9, "expression.md#register"],
    ])
    expect(report.findings.map(({ check, severity }) => [check, severity])).toEqual([
      ["notation", "warn"],
      ["notation", "warn"],
      ["notation", "warn"],
      ["notation", "warn"],
      ["expression", "warn"],
    ])
    expect(report.findings.map(({ reason }) => reason)).toEqual([
      "fullwidth_tilde here; the text mostly uses wave_dash (1 to 1)",
      "double here; the text mostly uses corner (1 to 1)",
      'drop here; the text mostly uses keep (3 to 1); the other form is "ブラウザー"',
      "small_ke here; the text mostly uses hiragana (1 to 1)",
      "plain here; the text mostly uses polite (5 to 1)",
    ])
    expect(report.conventions.quotes).toEqual({ value: "corner", source: "document" })
    expect(report.conventions.range_mark).toEqual({ value: "wave_dash", source: "document" })
    expect(report.conventions.long_vowel).toEqual({ value: "keep", source: "document" })
    expect(report.conventions.counter_ka).toEqual({ value: "hiragana", source: "document" })
    expect(report.conventions.register).toEqual({ value: "polite", source: "document" })
    expect(report.counts.by_check.notation).toEqual({ critical: 0, warn: 4, info: 0 })
    expect(report.counts.by_check.expression).toEqual({ critical: 0, warn: 1, info: 0 })
  })

  test("holds the text to values given as arguments or settings, and reports their source", async () => {
    const report = await invoke(
      writingTextRead,
      { method: "inspect", text: TEXT, register: "plain", quotes: "double" },
      { ...CTX, options: { range_mark: "fullwidth_tilde", counter_ka: "small_ke" } },
    )
    expect(report.conventions.register).toEqual({ value: "plain", source: "argument" })
    expect(report.conventions.range_mark).toEqual({ value: "fullwidth_tilde", source: "setting" })
    const found = report.findings.map(({ rule }) => rule)
    expect(found.filter((rule) => rule === "register")).toHaveLength(5)
    expect(found).toContain("quotes")
    expect(found).toContain("range_mark")
    expect(found).toContain("counter_ka")
    expect(report.conventions.long_vowel).toEqual({ value: "keep", source: "document" })
  })

  test("runs only the check that was asked for", async () => {
    const report = await invoke(
      writingTextRead,
      { method: "inspect", text: TEXT, checks: ["expression"], exclude_rules: RHYTHM_RULES },
      CTX,
    )
    expect(report.findings.map(({ rule }) => rule)).toEqual(["register"])
    expect(report.conventions.quotes).toEqual({ value: null, source: "unset" })
  })
})
