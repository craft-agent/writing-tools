import { describe, expect, test } from "bun:test"
import { readTokens } from "./readability.tokens.testing"

const LEXICON = [
  "東京/名詞/固有名詞",
  "江戸/名詞/固有名詞",
  "会社/名詞/普通名詞",
  "部長/名詞/普通名詞",
  "名前/名詞/普通名詞",
  "住所/名詞/普通名詞",
  "旧称/名詞/普通名詞",
  "本/名詞/普通名詞",
  "注釈/名詞/普通名詞",
  "確認/名詞/サ変可能",
  "た/助動詞",
  "（/補助記号/括弧開",
  "）/補助記号/括弧閉",
  "(/補助記号/括弧開",
  ")/補助記号/括弧閉",
]

/** The same words with the の of a nominalized phrase, in place of the case-marking one. */
const NOMINALIZING = ["の/助詞/準体助詞", ...LEXICON]

const find = (text: string, options = {}, lexicon: readonly string[] | undefined = LEXICON) =>
  readTokens("no_chain", text, lexicon, { options })
const spans = (text: string, options = {}) => find(text, options).map((hit) => hit.text)

describe("no_chain", () => {
  test("reports three case-marking の in a row, once, from the word before the first の through the word after the last", () => {
    expect(find("東京の会社の部長の名前を確認した。")).toEqual([
      {
        text: "東京の会社の部長の名前",
        start: 0,
        reason:
          "3 case-marking の in a chain, past 2; rewording some as a verb, a compound or a separate clause may read lighter",
      },
    ])
  })

  test("stops at the の where the word before or after is missing or is a mark", () => {
    expect(spans("の会社の部長の名前を確認した。")).toEqual(["の会社の部長の名前"])
    expect(spans("「東京の会社の部長の」名前を確認した。")).toEqual(["東京の会社の部長の"])
  })

  test("leaves two alone, and reports a longer chain once, with its count", () => {
    expect(spans("東京の会社の名前を確認した。")).toEqual([])
    const longer = find("東京の会社の部長の名前の住所を確認した。")
    expect(longer.map((hit) => hit.text)).toEqual(["東京の会社の部長の名前の住所"])
    expect(longer[0].reason).toStartWith("4 case-marking の in a chain, past 2;")
  })

  test("reports every chain of a sentence, and of each sentence", () => {
    expect(spans("東京の会社の部長の名前を確認し、江戸の旧称の住所の本を確認した。")).toEqual([
      "東京の会社の部長の名前",
      "江戸の旧称の住所の本",
    ])
    expect(spans("東京の会社の部長の名前を確認した。江戸の旧称の住所の本を確認した。")).toHaveLength(2)
  })

  test("is moved by the `no_chain` setting", () => {
    const text = "東京の会社の部長の名前を確認した。"
    expect(spans(text, { no_chain: 3 })).toEqual([])
    expect(spans(text, { no_chain: 2 })).toHaveLength(1)
    const four = "東京の会社の部長の名前の住所を確認した。"
    expect(spans(four, { no_chain: 3 })).toHaveLength(1)
    expect(find(four, { no_chain: 3 })[0].reason).toStartWith("4 case-marking の in a chain, past 3;")
    expect(spans(four, { no_chain: 4 })).toEqual([])
  })

  test("joins の that follow within three tokens, and not a longer way", () => {
    expect(spans("東京の会社名前の部長住所の本を確認した。")).toEqual(["東京の会社名前の部長住所の本"])
    expect(spans("東京の会社名前住所の部長の名前を確認した。")).toEqual([])
  })

  test("is broken by a mark between two の", () => {
    expect(spans("東京の会社の、部長の名前を確認した。")).toEqual([])
    expect(spans("東京の会社の「部長の名前」を確認した。")).toEqual([])
  })

  test("counts the tokens that are words, not the spaces between them", () => {
    expect(spans("東京の 会社 名前 の部長の名前を確認した。")).toEqual(["東京の 会社 名前 の部長の名前"])
  })

  test("reads a parenthetical as if it were not there: it neither joins nor breaks a chain", () => {
    expect(spans("東京の会社の（注釈）部長の名前を確認した。")).toEqual(["東京の会社の（注釈）部長の名前"])
    expect(spans("東京の会社の本（注釈）名前の確認した。")).toEqual(["東京の会社の本（注釈）名前の確認"])
    expect(spans("東京の(江戸の旧称の)会社の名前を確認した。")).toEqual([])
    expect(spans("東京の（江戸の旧称の）会社の名前を確認した。")).toEqual([])
  })

  test("is broken by a closing parenthesis that closes nothing, as by any mark", () => {
    expect(spans("東京の会社の）部長の名前を確認した。")).toEqual([])
  })

  test("counts only the case-marking の: another の does not join", () => {
    expect(find("東京の会社の部長の名前を確認した。", {}, NOMINALIZING)).toEqual([])
  })

  test("reads the sentences of list items too", () => {
    expect(spans("- 東京の会社の部長の名前を確認した。")).toEqual(["東京の会社の部長の名前"])
  })

  test("reports nothing without tokens, or for the blocks the engine skipped, and can be excluded", () => {
    const text = "東京の会社の部長の名前を確認した。"
    expect(readTokens("no_chain", text, undefined)).toEqual([])
    expect(readTokens("no_chain", text, LEXICON, { only: [] })).toEqual([])
    expect(readTokens("no_chain", text, LEXICON, { exclude: ["no_chain"] })).toEqual([])
  })
})
