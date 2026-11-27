import { describe, expect, test } from "bun:test"
import { invoke } from "../../tool"
import { writingTextRead } from "../read"

const CTX = { cwd: process.cwd() }

/** The rules this file looks at; the others of the expression check may also report on its text. */
const WORDING_RULES = ["stock_phrase", "translationese", "vague_buzzword", "metaphor_verb", "contrast_overuse", "emoji"]

const TEXT = [
  "# 運用の見直し",
  "",
  "まず最初に設定を確認することができます。次に、各チームごとに結果を共有します。",
  "",
  "課題の解像度を上げて、業務を回す。速さではなく、正確さを選ぶ。品質ではなく、納期を守る。🎉",
  "",
  "- 再起動することによって直ります",
  "- 本番の変更は、速さではなく手順を重く見る",
].join("\n")

/** The wording findings of an inspect call, as rule, severity, line, column and reference. */
async function wording(args: Record<string, unknown> = {}) {
  const report = await invoke(writingTextRead, { method: "inspect", text: TEXT, ...args }, CTX)
  return report.findings.filter(({ rule }) => WORDING_RULES.includes(rule))
}

describe("writing_text_read with the phrase and wording rules", () => {
  test("reports the stock phrases and translationese by default, at the phrase", async () => {
    const found = await wording()
    expect(
      found.map(({ rule, severity, line, column, reference }) => [rule, severity, line, column, reference]),
    ).toEqual([
      ["stock_phrase", "info", 3, 1, "expression.md#stock_phrase"],
      ["translationese", "info", 3, 11, "expression.md#translationese"],
      ["stock_phrase", "info", 3, 24, "expression.md#stock_phrase"],
      ["translationese", "info", 7, 6, "expression.md#translationese"],
    ])
    expect(found.map(({ reason }) => reason)).toEqual([
      '"まず最初に": "まず" says the same',
      '"することができ": "でき" says the same',
      '"各チームごと": say 各 or ごと, not both',
      '"することによって": "することで" says the same',
    ])
  })

  test("runs the four other rules only when `rules` names them", async () => {
    const found = await wording({ rules: ["vague_buzzword", "metaphor_verb", "contrast_overuse", "emoji"] })
    expect(found.map(({ rule, line }) => [rule, line])).toEqual([
      ["stock_phrase", 3],
      ["translationese", 3],
      ["stock_phrase", 3],
      ["vague_buzzword", 5],
      ["metaphor_verb", 5],
      ["contrast_overuse", 5],
      ["emoji", 5],
      ["translationese", 7],
    ])
    expect(found.every(({ severity }) => severity === "info")).toBe(true)
  })

  test("leaves a rule out when `exclude_rules` names it", async () => {
    const found = await wording({ exclude_rules: ["stock_phrase", "translationese"] })
    expect(found).toEqual([])
  })
})
