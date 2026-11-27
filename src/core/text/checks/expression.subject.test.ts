import { describe, expect, test } from "bun:test"
import { readWith } from "./expression.tokens.testing"

const LEXICON = [
  "この/連体詞",
  "その/連体詞",
  "これ/代名詞",
  "それ/代名詞",
  "彼/代名詞",
  "事実/名詞/普通名詞",
  "こと/名詞/普通名詞",
  "設定/名詞/普通名詞",
  "課題/名詞/普通名詞",
  "問題/名詞/普通名詞",
  "価値/名詞/普通名詞",
  "大きさ/名詞/普通名詞",
  "理解/名詞/サ変可能",
  "説明/名詞/サ変可能",
  "浮き彫り/名詞/普通名詞",
  "後押し/名詞/サ変可能",
  "新しい/形容詞/一般",
  "重要/形状詞/一般",
  "物語っ/動詞/一般=物語る",
  "示し/動詞/一般=示す",
  "示す/動詞/一般",
  "もたらす/動詞/一般",
  "て/助詞/接続助詞",
  "いる/動詞/非自立可能",
  "た/助動詞",
  "ます/助動詞",
]

const ON = { rules: ["inanimate_subject"] }

const find = (text: string, only?: readonly number[]) =>
  readWith("inanimate_subject", text, LEXICON, { given: ON, only }).map((hit) => hit.text)

describe("inanimate_subject", () => {
  test("is off by default and runs when `rules` names it", () => {
    const text = "この事実は課題の大きさを物語っている。"
    expect(readWith("inanimate_subject", text, LEXICON)).toEqual([])
    expect(find(text)).toEqual(["この事実は課題の大きさを物語っ"])
  })

  test("reports a demonstrative or an abstract noun with が or は, and a claim verb after it, naming both", () => {
    const [hit] = readWith("inanimate_subject", "この事実は課題の大きさを物語っている。", LEXICON, { given: ON })
    expect(hit.reason).toBe(
      'the abstract subject "この事実" takes the verb "物語る"; a person or an action as the subject may read more directly',
    )
    expect(find("それは新しい価値を示した。")).toEqual(["それは新しい価値を示し"])
    expect(find("これが課題をもたらす。")).toEqual(["これが課題をもたらす"])
    expect(find("そのことは理解を示す。")).toEqual(["そのことは理解を示す"])
    expect(find("事実は課題を示す。")).toEqual(["事実は課題を示す"])
    expect(find("新しいことが課題を示す。")).toEqual(["ことが課題を示す"])
  })

  test("reads a noun and する or にする as the verb they make", () => {
    expect(find("これが問題を浮き彫りにする。")).toEqual(["これが問題を浮き彫りにする"])
    expect(find("そのことは理解を後押しします。")).toEqual(["そのことは理解を後押しし"])
    expect(find("それは問題を後押しする。")).toEqual(["それは問題を後押しする"])
  })

  test("is quiet when a part is missing", () => {
    expect(find("これを示す。")).toEqual([])
    expect(find("課題を示す。これは重要です。")).toEqual([])
    expect(find("これは重要です。課題を示す。")).toEqual([])
    expect(find("彼は課題を示した。")).toEqual([])
    expect(find("この設定は問題を説明する。")).toEqual([])
    expect(find("この設定は課題を示す。")).toEqual([])
    expect(find("これは問題を説明する。")).toEqual([])
  })

  test("reports one finding for a sentence, at its first subject that has a claim verb after it", () => {
    expect(find("これは重要で、それは課題を示す。")).toEqual(["これは重要で、それは課題を示す"])
    expect(find("これは課題を示し、それは問題を示す。")).toEqual(["これは課題を示し"])
    expect(find("これは重要で、それは課題です。この事実は課題を示す。")).toEqual(["この事実は課題を示す"])
    expect(find("これは課題を示す。それは問題を示す。")).toEqual(["これは課題を示す", "それは問題を示す"])
  })

  test("reads body text and list items, a sentence without a terminator included", () => {
    expect(find("- この事実は課題を示す")).toEqual(["この事実は課題を示す"])
    expect(find("# この事実は課題を示す\n\n課題です。")).toEqual([])
  })

  test("sees only the blocks the engine read", () => {
    const text = "この事実は課題を示す。\n\nそれは問題を示す。"
    expect(find(text, [1])).toEqual(["それは問題を示す"])
    expect(find(text)).toEqual(["この事実は課題を示す", "それは問題を示す"])
  })

  test("reports nothing without tokens", () => {
    expect(readWith("inanimate_subject", "この事実は課題を示す。", undefined, { given: ON })).toEqual([])
  })

  test("can be excluded", () => {
    const given = { ...ON, exclude_rules: ["inanimate_subject"] }
    expect(readWith("inanimate_subject", "この事実は課題を示す。", LEXICON, { given })).toEqual([])
  })
})
