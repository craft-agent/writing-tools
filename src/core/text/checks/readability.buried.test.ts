import { describe, expect, test } from "bun:test"
import { readTokens } from "./readability.tokens.testing"

const LEXICON = [
  "予算/名詞/普通名詞",
  "日程/名詞/普通名詞",
  "場所/名詞/普通名詞",
  "担当/名詞/サ変可能",
  "会社/名詞/普通名詞",
  "工場/名詞/普通名詞",
  "店/名詞/普通名詞",
  "東京/名詞/固有名詞",
  "大阪/名詞/固有名詞",
  "福岡/名詞/固有名詞",
  "調査/名詞/サ変可能",
  "開発/名詞/サ変可能",
  "確認/名詞/サ変可能",
  "注/名詞/普通名詞",
  "版/名詞/普通名詞",
  "者/接尾辞/名詞的",
  "やすい/接尾辞/形容詞的",
  "各/接頭辞",
  "買い/動詞/一般=買う",
  "決め/動詞/一般=決める",
  "回っ/動詞/一般=回る",
  "た/助動詞",
  "そして/接続詞",
  "あ/感動詞",
  "，/補助記号/読点",
  "（/補助記号/括弧開",
  "）/補助記号/括弧閉",
]

/** A sentence of exactly `length` characters, the terminator included: `head` and a filler that leaves the list alone. */
const sentence = (head: string, length: number) => `${head}${"あ".repeat(length - [...head].length - 1)}。`

const find = (text: string, lexicon: readonly string[] | undefined = LEXICON) =>
  readTokens("buried_list", text, lexicon).map((hit) => hit.text)

describe("buried_list", () => {
  test("reports three items in a sentence of 80 characters, from the first item through the noun phrase of the last", () => {
    const text = sentence("予算、日程、場所を決めた", 80)
    expect(readTokens("buried_list", text, LEXICON)).toEqual([
      {
        text: "予算、日程、場所",
        start: 0,
        reason: "3 items split by commas in a sentence of 80 characters, 80 or more; a bulleted list may read easier",
      },
    ])
    expect(find(sentence("予算、日程、場所を決めた", 79))).toEqual([])
  })

  test("needs a sentence of 50 characters for four items or more, and 80 for three", () => {
    expect(find(sentence("予算、日程、担当、場所を決めた", 50))).toEqual(["予算、日程、担当、場所"])
    expect(find(sentence("予算、日程、担当、場所を決めた", 49))).toEqual([])
    expect(find(sentence("予算、日程、場所を決めた", 50))).toEqual([])
    const five = sentence("予算、日程、担当、会社、場所を決めた", 50)
    expect(readTokens("buried_list", five, LEXICON)[0].reason).toStartWith(
      "5 items split by commas in a sentence of 50",
    )
  })

  test("checks the last item: it must open with a noun, after a prefix or a bracket", () => {
    expect(find(sentence("予算、日程、そして場所を決めた", 120))).toEqual([])
    expect(find(sentence("予算、日程、決めた", 120))).toEqual([])
    expect(find(sentence("予算、日程、各場所を決めた", 80))).toEqual(["予算、日程、各場所"])
    expect(find(sentence("「予算」、「日程」、「場所」を決めた", 80))).toEqual(["「予算」、「日程」、「場所」"])
  })

  test("ends the last item at its noun phrase: nouns, suffixes and の and a noun", () => {
    expect(find(sentence("東京の会社、大阪の工場、福岡の店を回った", 80))).toEqual(["東京の会社、大阪の工場、福岡の店"])
    expect(find(sentence("調査者、開発者、各場所の担当を決めた", 80))).toEqual(["調査者、開発者、各場所の担当"])
  })

  test("ends an item in a noun, or in a suffix that follows one", () => {
    expect(find(sentence("調査者、開発者、場所を決めた", 80))).toHaveLength(1)
    expect(find(sentence("予算、日程、買いやすい、場所を決めた", 120))).toEqual([])
  })

  test("reads an item that ends in a parenthetical as ending where the parenthetical begins", () => {
    expect(find(sentence("予算（確認した）、日程（確認した）、場所を決めた", 80))).toEqual([
      "予算（確認した）、日程（確認した）、場所",
    ])
    expect(find(sentence("予算を決めた（予算）、日程（予算）、場所を決めた", 120))).toEqual([])
  })

  test("splits at commas of both kinds, and not at a comma inside brackets", () => {
    expect(find(sentence("予算，日程，場所を決めた", 80))).toHaveLength(1)
    const text = sentence("予算（注、版）、日程、場所を決めた", 80)
    expect(readTokens("buried_list", text, LEXICON)[0].reason).toStartWith("3 items")
    expect(find(sentence("予算「注、版」、日程、場所を決めた", 80))).toHaveLength(1)
  })

  test("reports a run that reaches the end of the sentence, its last item the run's", () => {
    expect(find(`${"あ".repeat(50)}予算、日程、場所、担当。`)).toEqual([`${"あ".repeat(50)}予算、日程、場所、担当`])
    expect(find(`${"あ".repeat(80)}予算、日程。`)).toEqual([])
  })

  test("reports every list of a sentence", () => {
    expect(find(sentence("予算、日程、場所を決め、東京、大阪、福岡を回った", 80))).toEqual([
      "予算、日程、場所",
      "東京、大阪、福岡",
    ])
  })

  test("leaves clauses and two items alone", () => {
    expect(find(sentence("予算を決め、日程を決め、場所を決めた", 120))).toEqual([])
    expect(find(sentence("予算、場所を決めた", 120))).toEqual([])
  })

  test("counts the words and not the spaces between them", () => {
    expect(find(sentence("予算、 日程、 場所を決めた", 82))).toEqual(["予算、 日程、 場所"])
  })

  test("reads the sentences of list items too", () => {
    expect(find(`- ${sentence("予算、日程、場所を決めた", 80)}`)).toHaveLength(1)
  })

  test("reports nothing without tokens, or for the blocks the engine skipped, and can be excluded", () => {
    const text = sentence("予算、日程、場所を決めた", 80)
    expect(readTokens("buried_list", text, undefined)).toEqual([])
    expect(readTokens("buried_list", text, LEXICON, { only: [] })).toEqual([])
    expect(readTokens("buried_list", text, LEXICON, { exclude: ["buried_list"] })).toEqual([])
  })
})
