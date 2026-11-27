import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { compile } from "./phrases"
import { MARKER_KINDS, MARKER_PHRASES, markersOf } from "./markers"

/** The markers of one sentence as [kind, surface]. */
function found(text: string): [string, string][] {
  const doc = readDocument(text)
  return markersOf(doc, 0, doc.text.length).map(({ kind, surface }) => [kind, surface])
}

describe("the marker lists", () => {
  test("hold only entries that match their sample", () => {
    for (const { kind } of MARKER_KINDS)
      for (const { pattern, sample } of MARKER_PHRASES[kind]) {
        expect(compile(pattern).exec(sample)?.[0]).toBeTruthy()
      }
  })
})

describe("markersOf, obligation", () => {
  test("reads the wordings of a must", () => {
    expect(found("確認しなければなりません。")).toEqual([["obligation", "なければなりません"]])
    expect(found("入力しないといけない。")).toEqual([["obligation", "ないといけない"]])
    expect(found("確認するべきです。")).toEqual([["obligation", "べきです"]])
    expect(found("確認する必要があります。")).toEqual([["obligation", "必要があります"]])
    expect(found("この項目は必須です。")).toEqual([["obligation", "必須"]])
  })

  test("reads 必要 only before がある or a copula, never in a noun phrase", () => {
    expect(found("必要な機能を選びます。")).toEqual([])
    expect(found("必要がありません。")).toEqual([])
    expect(found("それは不必要です。")).toEqual([])
    expect(found("手順が必要です。")).toEqual([["obligation", "必要です"]])
  })

  test("never reads べき乗, or 必須 that is denied", () => {
    expect(found("2のべき乗を求める。")).toEqual([])
    expect(found("この項目は必須ではありません。")).toEqual([])
  })
})

describe("markersOf, conjecture", () => {
  test("reads the wordings of a guess", () => {
    expect(found("明日は雨でしょう。")).toEqual([["conjecture", "でしょう"]])
    expect(found("遅れるかもしれません。")).toEqual([["conjecture", "かもしれません"]])
    expect(found("原因はこれだと考えられる。")).toEqual([["conjecture", "と考えられ"]])
    expect(found("届くはずです。")).toEqual([["conjecture", "はずです"]])
    expect(found("おそらく届きます。")).toEqual([["conjecture", "おそらく"]])
    expect(found("遅れる可能性があります。")).toEqual([["conjecture", "可能性があります"]])
    expect(found("届いたようです。")).toEqual([["conjecture", "ようです"]])
  })

  test("reads らしい only after a verb ending", () => {
    expect(found("明日は来るらしい。")).toEqual([["conjecture", "らしい"]])
    expect(found("彼らしい答えです。")).toEqual([])
    expect(found("かわいらしい絵です。")).toEqual([])
    expect(found("素晴らしい結果です。")).toEqual([])
    expect(found("あたらしい手順です。")).toEqual([])
  })

  test("never reads はず in はずす, ように, 多分に or ようでしたら", () => {
    expect(found("ねじをはずす。")).toEqual([])
    expect(found("届くように送る。")).toEqual([])
    expect(found("多分に影響する。")).toEqual([])
    expect(found("ご希望のようでしたらご連絡ください。")).toEqual([])
  })
})

describe("markersOf, emphasis", () => {
  test("reads the words that insist", () => {
    expect(found("必ず保存します。")).toEqual([["emphasis", "必ず"]])
    expect(found("絶対に消さない。")).toEqual([["emphasis", "絶対に"]])
    expect(found("常に最新です。")).toEqual([["emphasis", "常に"]])
    expect(found("決して忘れない。")).toEqual([["emphasis", "決して"]])
    expect(found("非常に重要です。")).toEqual([["emphasis", "非常に"]])
    expect(found("極めて重要です。")).toEqual([["emphasis", "極めて"]])
    expect(found("明らかに誤りです。")).toEqual([["emphasis", "明らかに"]])
    expect(found("これこそ本題です。")).toEqual([["emphasis", "こそ"]])
  })

  test("never reads a word that only contains one", () => {
    expect(found("必ずしも正しくない。")).toEqual([])
    expect(found("絶対値を使う。")).toEqual([])
    expect(found("絶対パスで指定する。")).toEqual([])
    expect(found("正常に動作する。")).toEqual([])
    expect(found("課題を解決して進める。")).toEqual([])
    expect(found("原因を明らかにする。")).toEqual([])
    expect(found("技を極めている。")).toEqual([])
    expect(found("こそこそ話す。")).toEqual([])
  })
})

describe("markersOf, what it reads", () => {
  test("reads a marker wrapped over a line break and gives its span in the text", () => {
    const doc = readDocument("確認しなけ\nればなりません。")
    const [marker] = markersOf(doc, 0, doc.text.length)
    expect(marker.surface).toBe("なければなりません")
    expect(doc.text.slice(marker.start, marker.end)).toBe("なけ\nればなりません")
  })

  test("never reads inside masked text or across it", () => {
    expect(found("`べきです` と書く。")).toEqual([])
    expect(found("かも`x`しれません。")).toEqual([])
  })

  test("counts overlapping wordings of one kind once", () => {
    expect(found("確認すべきである。")).toEqual([["obligation", "べきである"]])
  })

  test("reads every kind in one sentence, in order of position", () => {
    expect(found("必ず確認すべきです。遅れるかもしれません。").map(([kind]) => kind)).toEqual([
      "emphasis",
      "obligation",
      "conjecture",
    ])
  })
})
