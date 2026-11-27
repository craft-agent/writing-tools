import { describe, expect, test } from "bun:test"
import { reasons, revise } from "./revision.testing"

describe("the revision check, names", () => {
  test("finds a name the revision lost and one it added, each with its places", async () => {
    const report = await revise("前置きです。\n\nAPI を使います。", "前置きです。\n\nGitHub を使います。")
    expect(report.findings).toEqual([
      {
        check: "revision",
        rule: "name_added",
        severity: "warn",
        line: 3,
        column: 1,
        excerpt: "前置きです。  GitHub を使います。",
        reason: '"GitHub" is in the revision but not in the original',
        reference: "revision.md#name_added",
      },
      {
        check: "revision",
        rule: "name_lost",
        severity: "critical",
        line: 3,
        column: 1,
        original_line: 3,
        original_column: 1,
        excerpt: "前置きです。  API を使います。",
        reason: '"API" is in the original but not in the revision',
        reference: "revision.md#name_lost",
      },
    ])
  })

  test("finds acronyms, Latin names and katakana words of three characters or more", async () => {
    const report = await revise("HTTP と Python と サーバー と データ を使う。", "を使う。")
    expect(reasons(report).map(([, reason]) => reason.split('"')[1])).toEqual(["HTTP", "Python", "サーバー", "データ"])
  })

  test("keys the forms of a name as the terms inventory does, so a closing ー or a width is no change", async () => {
    expect((await revise("サーバーを使う。", "サーバを使う。")).findings).toEqual([])
    expect((await revise("ＡＰＩを使う。", "APIを使う。")).findings).toEqual([])
  })

  test("counts a name over the whole text, one finding for each use it has fewer or more of", async () => {
    const fewer = await revise("API を使う。\n\nまた API を使う。", "API を使う。\n\nまた別を使う。")
    expect(reasons(fewer)).toEqual([["name_lost", '"API" is in the original but not in the revision']])
    expect(fewer.findings[0]).toMatchObject({ original_line: 3 })
    const more = await revise("API を使う。", "API を使う。API は便利だ。API も使う。")
    expect(more.findings.map(({ rule }) => rule)).toEqual(["name_added", "name_added"])
  })

  test("finds nothing when a sentence only moved", async () => {
    const report = await revise(
      "API を使う。\n\nGitHub に載せる。\n\n終わり。",
      "GitHub に載せる。\n\n終わり。\n\nAPI を使う。",
    )
    expect(report.findings).toEqual([])
  })

  test("reads a Capitalized word as a name only when no Latin word is beside it", async () => {
    expect(reasons(await revise("Linux で書く。", "別の語で書く。"))).toHaveLength(1)
    expect((await revise("The Linux kernel を使う。", "別の語を使う。")).findings).toEqual([])
  })

  test("never reads masked text or a quotation", async () => {
    expect((await revise("`API` を使う。\n\n> GitHub", "別の語を使う。")).findings).toEqual([])
  })

  test("is left out when exclude_rules names it", async () => {
    const report = await revise("API を使う。", "GitHub を使う。", { exclude_rules: ["name_added"] })
    expect(report.findings.map(({ rule }) => rule)).toEqual(["name_lost"])
  })
})
