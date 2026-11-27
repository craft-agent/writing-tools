import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./expression.testing"
import { BUZZWORD_REASON, METAPHOR_REASON, METAPHOR_VERBS, VAGUE_BUZZWORDS } from "./figurative"
import { compile } from "./phrases"

const ON = { rules: ["vague_buzzword", "metaphor_verb"] }

describe("the lists of buzzwords and metaphors", () => {
  test("match their sample, each one once", () => {
    for (const list of [VAGUE_BUZZWORDS, METAPHOR_VERBS]) {
      const patterns = list.map(({ pattern }) => pattern)
      expect(new Set(patterns).size).toBe(patterns.length)
      for (const { pattern, sample } of list) expect(compile(pattern).exec(sample)?.[0]).toBeTruthy()
    }
  })
})

describe("vague_buzzword", () => {
  const find = (text: string) => matched("vague_buzzword", text, ON)

  test("is off by default, and reports once `rules` names it", () => {
    expect(matched("vague_buzzword", "課題の解像度を上げる。")).toEqual([])
    expect(find("課題の解像度を上げる。")).toEqual(["解像度を上げ"])
    expect(reasonsOf("vague_buzzword", "腹落ちする。", ON)).toEqual([BUZZWORD_REASON])
  })

  test("reports each word of the list, spanning the word", () => {
    expect(find("腹落ちするまで話し、肌感覚を持ち、温度感をそろえる。")).toEqual(["腹落ち", "肌感覚", "温度感"])
    expect(find("爆速で進め、考えを言語化し、計画に落とし込む。")).toEqual(["爆速", "言語化", "落とし込む"])
    expect(find("エモい文章が読者に刺さる。")).toEqual(["エモい", "読者に刺さ"])
    expect(find("地に足のついた計画で本質的な課題を、ブラッシュアップする。")).toEqual([
      "地に足のついた",
      "本質的な",
      "ブラッシュアップ",
    ])
    expect(find("現場に寄り添う。熱量を感じる。ゲームチェンジャーだ。")).toEqual([
      "現場に寄り添",
      "熱量を感じ",
      "ゲームチェンジャー",
    ])
  })

  test("takes 解像度 only as a figure, never as the sharpness of a screen or a picture", () => {
    expect(find("画面の解像度を上げる。")).toEqual([])
    expect(find("このモニターは解像度が高い。")).toEqual([])
    expect(find("写真の解像度が低い。カメラの解像度を高める。")).toEqual([])
    expect(find("解像度は1920×1080です。高解像度の画像。")).toEqual([])
    expect(find("論点の解像度が高い人。")).toEqual(["解像度が高"])
  })

  test("takes a word with a literal use only in its figurative frame", () => {
    expect(find("食品の熱量を表示する。とげが刺さる。")).toEqual([])
    expect(find("ナイフが刺さる。エモーションを示す。")).toEqual([])
    expect(find("この設計は最適解を探す。")).toEqual([])
  })

  test("never matches masked text, and reads headings, lists and no quotation", () => {
    expect(find("`腹落ち`を調べる。")).toEqual([])
    expect(find("## 腹落ちの条件\n- 爆速\n> 温度感")).toEqual(["腹落ち", "爆速"])
  })
})

describe("metaphor_verb", () => {
  const find = (text: string) => matched("metaphor_verb", text, ON)

  test("is off by default, and reports once `rules` names it", () => {
    expect(matched("metaphor_verb", "業務を回す。")).toEqual([])
    expect(find("業務を回す。")).toEqual(["業務を回す"])
    expect(reasonsOf("metaphor_verb", "業務を回す。", ON)).toEqual([METAPHOR_REASON])
  })

  test("reports each metaphor of the list, spanning the phrase", () => {
    expect(find("会議が時間を溶かす。合意を握る。新しい機能が生える。")).toEqual([
      "時間を溶か",
      "合意を握る",
      "機能が生え",
    ])
    expect(find("操作の手触りがよい。施策がじわじわ効く。この改善は地味に効く。")).toEqual([
      "操作の手触り",
      "じわじわ効く",
      "地味に効く",
    ])
    expect(find("導入の背中を押す。組織の風通しがよい。課題を棚卸しする。")).toEqual([
      "導入の背中を押す",
      "組織の風通し",
      "課題を棚卸し",
    ])
    expect(find("仕様の地雷を踏む。原因を炙り出す。仕事が回らない。")).toEqual([
      "地雷を踏む",
      "原因を炙り出",
      "仕事が回ら",
    ])
  })

  test("is quiet on the literal use", () => {
    expect(find("現場を回る。ボールを握る。")).toEqual([])
    expect(find("布の手触りがよい。部屋の風通しがよい。")).toEqual([])
    expect(find("子どもの背中を押してブランコを揺らす。")).toEqual([])
    expect(find("回覧を回す。")).toEqual([])
  })

  test("never matches masked text", () => {
    expect(find("`業務を回す`と書く。")).toEqual([])
    expect(find("業務を`回`す。")).toEqual([])
  })
})
