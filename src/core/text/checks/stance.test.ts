import { describe, expect, test } from "bun:test"
import { classifyStanceEnding, type EndingKind } from "./stance"

/** The kind and the ending of what `body` ends in, or `undefined`. */
function ending(body: string): [EndingKind, string] | undefined {
  const found = classifyStanceEnding(body)
  return found === undefined ? undefined : [found.kind, found.ending]
}

describe("classifyStanceEnding", () => {
  test("reads each recommendation ending", () => {
    const table: [string, string][] = [
      ["画面を開きましょう", "ましょう"],
      ["早めに確認するとよいでしょう", "とよいでしょう"],
      ["早めに確認するとよいです", "とよいです"],
      ["早めに確認するといいです", "といいです"],
      ["この設定をおすすめします", "をおすすめします"],
      ["この設定をお勧めします", "をお勧めします"],
      ["確認することをおすすめします", "ことをおすすめします"],
      ["先に保存するべきです", "べきです"],
      ["先に保存するべきだ", "べきだ"],
    ]
    for (const [body, matched] of table) expect(ending(body)).toEqual(["recommendation", matched])
  })

  test("reads each request ending", () => {
    const table: [string, string][] = [
      ["詳細は付録をご覧ください", "ください"],
      ["詳細は付録をご覧下さい", "下さい"],
      ["詳細を確認してください", "てください"],
      ["詳細を確認してほしい", "してほしい"],
      ["ご確認をお願いします", "お願いします"],
    ]
    for (const [body, matched] of table) expect(ending(body)).toEqual(["request", matched])
  })

  test("reads each evaluation ending, polite and plain", () => {
    const table: [string, string][] = [
      ["手順の順番が重要です", "重要です"],
      ["手順の順番が大切です", "大切です"],
      ["手順の順番が大事です", "大事です"],
      ["この設定は不可欠です", "不可欠です"],
      ["この設定は必要です", "必要です"],
      ["この設定は欠かせません", "欠かせません"],
      ["手順の順番が重要だ", "重要だ"],
      ["手順の順番が大切である", "大切である"],
      ["この設定は必要である", "必要である"],
    ]
    for (const [body, matched] of table) expect(ending(body)).toEqual(["evaluation", matched])
  })

  test("reads a polite verb as an action, with the last of its stem", () => {
    expect(ending("ボタンを押します")).toEqual(["action", "します"])
    expect(ending("設定を開きます")).toEqual(["action", "きます"])
    expect(ending("道具を使います")).toEqual(["action", "います"])
    expect(ending("検査を行います")).toEqual(["action", "います"])
  })

  test("does not read a passive, a progressive or a state as an action", () => {
    for (const body of [
      "設定は記録されます",
      "結果は表示されます",
      "画面から見られます",
      "処理が動いています",
      "文字を読んでいます",
      "設定項目があります",
      "問題になります",
      "実行できます",
      "部屋に猫がいます",
      "庭にもいます",
    ]) {
      expect(ending(body)).toBeUndefined()
    }
  })

  test("reads the fixed endings before the polite verb", () => {
    expect(ending("確認をお願いします")?.[0]).toBe("request")
    expect(ending("確認をおすすめします")?.[0]).toBe("recommendation")
    expect(ending("確認します")?.[0]).toBe("action")
  })

  test("reads neither a negative, a plain verb, a noun, a particle nor a lone verb ending", () => {
    for (const body of [
      "ボタンを押しません",
      "ボタンを押す",
      "確認手順の一覧",
      "確認しますが",
      "押しましょうか",
      "ます",
      "",
    ]) {
      expect(ending(body)).toBeUndefined()
    }
  })

  test("takes off what trails the wording, as register does, and says where the ending starts", () => {
    expect(classifyStanceEnding("**ボタンを押します**")).toEqual({ kind: "action", ending: "します", index: 7 })
    expect(classifyStanceEnding("画面を開きましょう（注）")).toEqual({
      kind: "recommendation",
      ending: "ましょう",
      index: 5,
    })
    expect(classifyStanceEnding("彼は「確認してください」")).toEqual({
      kind: "request",
      ending: "てください",
      index: 6,
    })
  })
})
