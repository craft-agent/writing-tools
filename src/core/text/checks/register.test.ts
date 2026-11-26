import { describe, expect, test } from "bun:test"
import { classifyEnding } from "./register"

const registerOf = (body: string) => classifyEnding(body)?.register

describe("classifyEnding", () => {
  test("reads the polite endings, with or without a closing particle", () => {
    const polite = [
      "確認します",
      "確認しません",
      "確認しました",
      "確認しませんでした",
      "確認しましょう",
      "これは本です",
      "これは本でした",
      "見てください",
      "見て下さい",
      "そうでしょう",
      "確認しますか",
      "本ですね",
      "本ですよ",
      "本ですよね",
      "そうでしょうか",
      "そうでしょうね",
    ]
    for (const body of polite) expect(registerOf(body), body).toBe("polite")
  })

  test("reads the plain endings, with or without a closing particle", () => {
    const plain = [
      "これは本だ",
      "これは本である",
      "これは本だった",
      "これは本であった",
      "これは本ではない",
      "これは本でない",
      "そうだろう",
      "そうだろうか",
      "そうだろうね",
      "そうだろうよ",
      "高い",
      "行った",
      "行く",
      "行こう",
      "話す",
      "待つ",
      "死ぬ",
      "遊ぶ",
      "読む",
      "泳ぐ",
      "ある",
    ]
    for (const body of plain) expect(registerOf(body), body).toBe("plain")
  })

  test("tries polite first, since でした and ください also end in a plain final character", () => {
    expect(registerOf("本でした")).toBe("polite")
    expect(registerOf("見てください")).toBe("polite")
    expect(registerOf("そうでしょう")).toBe("polite")
  })

  test("counts neither a noun ending, a particle ending nor an empty body", () => {
    for (const body of ["確認手順の一覧", "確認しますが", "確認しますので", "そうだよね", "行くか", "とても", ""]) {
      expect(classifyEnding(body), body).toBeUndefined()
    }
  })

  test("passes over trailing emphasis, closing brackets, spaces and a note in parentheses", () => {
    const polite = [
      "確認します（注）",
      "確認します (補足)",
      "確認します（注）（補足）",
      "確認します」",
      "「確認します」（注）",
      "彼は「確認します」",
      "**確認します**",
      "_確認します_",
      "確認します)  ",
      "（確認します）",
    ]
    for (const body of polite) expect(registerOf(body), body).toBe("polite")
    expect(registerOf("確認する（笑）")).toBe("plain")
    expect(registerOf("『確認する』")).toBe("plain")
  })

  test("reads a body that is nothing but a note as its note", () => {
    expect(classifyEnding("（注）")).toBeUndefined()
    expect(registerOf("（確認する）")).toBe("plain")
  })

  test("gives where the matched ending starts in the body", () => {
    expect(classifyEnding("これは本です")?.index).toBe(4)
    expect(classifyEnding("確認しませんでした")?.index).toBe(3)
    expect(classifyEnding("本ですよね")?.index).toBe(1)
    expect(classifyEnding("本である")?.index).toBe(1)
    expect(classifyEnding("確認する")?.index).toBe(3)
    expect(classifyEnding("確認します（注）")?.index).toBe(3)
  })
})
