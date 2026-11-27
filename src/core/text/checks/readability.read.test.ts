import { describe, expect, test } from "bun:test"
import { invoke } from "../../tool"
import { writingTextRead } from "../read"
import { READABILITY_TOKEN_RULES, unavailableReadability } from "./readability.tokens.testing"

const CTX = { cwd: process.cwd() }

/** A sentence of 50 characters: past 40, within the default 90. */
const MIDDLE = `${"あ".repeat(49)}。`

const readability = (text: string, options = {}, extra = {}) =>
  invoke(writingTextRead, { method: "inspect", text, checks: ["readability"], ...extra }, { ...CTX, options })

describe("writing_text_read with the readability check", () => {
  test("is one of the checks that run when none is named, and counts its findings by severity", async () => {
    const report = await invoke(writingTextRead, { method: "inspect", text: "情報処理技術者を募る。" }, CTX)
    expect(report.checks).toEqual(["notation", "expression", "readability", "outline", "terms"])
    expect(report.findings.map(({ check, rule, severity }) => [check, rule, severity])).toEqual([
      ["readability", "kanji_run", "info"],
    ])
    expect(report.counts.by_check.readability).toEqual({ critical: 0, warn: 0, info: 1 })
  })

  test("runs alone, and lists the rules that read tokens as not run without an engine", async () => {
    const report = await readability("朝起きて、顔を洗って、服を着て、家を出た。")
    expect(report.checks).toEqual(["readability"])
    expect(report.not_run).toEqual(unavailableReadability(...READABILITY_TOKEN_RULES))
    expect(report.findings).toEqual([
      {
        check: "readability",
        rule: "comma_run",
        severity: "info",
        line: 1,
        column: 1,
        excerpt: "朝起きて、顔を洗って、服を着て、家を出た。",
        reason:
          "3 clauses of 12 characters or fewer in a row, each ending at a comma; a longer clause or two sentences may read smoother",
        reference: "readability.md#comma_run",
      },
    ])
  })

  test("is quiet about a text that reads easily", async () => {
    const text = "今日は晴れていたので、公園まで歩いた。木の下で本を読み、帰りに友人と夕食を食べた。"
    expect((await readability(text)).findings).toEqual([])
  })

  test("is moved by the threshold settings, and the rule lists still apply", async () => {
    expect((await readability(MIDDLE)).findings).toEqual([])
    const moved = await readability(MIDDLE, { sentence_length: 40 })
    expect(moved.findings.map(({ rule, reason }) => [rule, reason])).toEqual([
      ["long_sentence", "50 characters, past 40; a sentence that holds two points may read better as two"],
    ])
    expect((await readability(MIDDLE, { sentence_length: 40 }, { exclude_rules: ["long_sentence"] })).findings).toEqual(
      [],
    )
    expect((await readability("情報処理技術者を募る。", { kanji_run: 7 })).findings).toEqual([])
    expect((await readability("経済政策案を示す。", { kanji_run: 4 })).findings).toHaveLength(1)
  })

  test("holds an essay to the setting too", async () => {
    expect((await readability(`${"あ".repeat(99)}。`, {}, { genre: "essay" })).findings).toEqual([])
    expect(
      (await readability(`${"あ".repeat(99)}。`, { sentence_length: 60 }, { genre: "essay" })).findings,
    ).toHaveLength(1)
  })
})
