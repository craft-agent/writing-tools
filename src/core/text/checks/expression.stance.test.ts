import { describe, expect, test } from "bun:test"
import type { Stance } from "../rules"
import { matched, reasonsOf, run } from "./expression.testing"

const find = (text: string, stance?: Stance) => matched("stance_ending", text, stance === undefined ? {} : { stance })

describe("stance_ending", () => {
  test("is neither run nor listed without a stance", () => {
    const text = "画面を開きましょう。ボタンを押します。手順の順番が大切です。"
    expect(find(text)).toEqual([])
    expect(run(text).findings.filter(({ rule }) => rule === "stance_ending")).toEqual([])
  })

  test("is off when excluded", () => {
    expect(
      matched("stance_ending", "ボタンを押します。", { stance: "advice", exclude_rules: ["stance_ending"] }),
    ).toEqual([])
  })

  test("reports an action in advice, spanning the ending through the terminator", () => {
    const text = "画面を開きましょう。ボタンを押します。設定は記録されます。"
    expect(find(text, "advice")).toEqual(["します。"])
    expect(reasonsOf("stance_ending", text, { stance: "advice" })).toEqual([
      'an action in advice: the sentence ends in "します"',
    ])
  })

  test("lets advice recommend, request and judge", () => {
    expect(find("早めに確認しましょう。詳細を見てください。この設定は必要です。", "advice")).toEqual([])
  })

  test("reports a recommendation or an evaluation in a rule, and lets a rule act and request", () => {
    const text = "毎日保存します。週に一度は見直しましょう。手順の順番が大切です。"
    expect(find(text, "rule")).toEqual(["ましょう。", "大切です。"])
    expect(reasonsOf("stance_ending", text, { stance: "rule" })).toEqual([
      'a recommendation in a rule: the sentence ends in "ましょう"',
      'an evaluation in a rule: the sentence ends in "大切です"',
    ])
    expect(find("毎日保存します。詳細は付録を見てください。", "rule")).toEqual([])
  })

  test("reports a recommendation or a request in an explanation, and lets it act and judge", () => {
    const text = "結果は三件でした。付録を見てください。早めに確認しましょう。差は小さいです。"
    expect(find(text, "explanation")).toEqual(["てください。", "ましょう。"])
    expect(reasonsOf("stance_ending", text, { stance: "explanation" })[0]).toBe(
      'a request in an explanation: the sentence ends in "てください"',
    )
    expect(find("設定を開きます。この設定は必要です。結果は三件でした。", "explanation")).toEqual([])
  })

  test("spares the last counted sentence of an explanation", () => {
    expect(find("結果は三件でした。詳細は付録を見てください。", "explanation")).toEqual([])
    expect(find("結果は三件でした。詳細は付録を見てください。\n\n# 付録\n", "explanation")).toEqual([])
    expect(find("結果は三件でした。詳細は付録を見てください。差は小さいです。", "explanation")).toHaveLength(1)
    expect(find("早めに確認しましょう。", "explanation")).toEqual([])
  })

  test("takes the last sentence that ends in a terminator as the last counted, whatever follows it", () => {
    expect(find("詳細は付録を見てください。結果は三件でした", "explanation")).toEqual([])
  })

  test("does not count a passive, a progressive or a state as an action", () => {
    const text =
      "設定は記録されます。処理が動いています。設定項目があります。問題になります。実行できます。猫がいます。"
    expect(find(text, "advice")).toEqual([])
  })

  test("counts the items of a list, but not a heading, a table, a quotation or an item without a terminator", () => {
    expect(find("- 画面を開きましょう。\n- 設定を保存します。", "rule")).toEqual(["ましょう。"])
    const quiet =
      "## 画面を開きましょう。\n\n| 画面を開きましょう。 |\n| --- |\n\n> 画面を開きましょう。\n\n- 画面を開きましょう\n"
    expect(find(quiet, "rule")).toEqual([])
  })

  test("leaves out masked text", () => {
    expect(find("`画面を開きましょう。`ボタンを押します。\n\n```\n画面を開きましょう。\n```\n", "rule")).toEqual([])
  })
})
