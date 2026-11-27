import { describe, expect, test } from "bun:test"
import { readWith } from "./expression.tokens.testing"

const LEXICON = [
  "設定/名詞/普通名詞",
  "確認/名詞/サ変可能",
  "画面/名詞/普通名詞",
  "手順/名詞/普通名詞",
  "色/名詞/普通名詞",
  "三つ/名詞/数詞",
  "これ/代名詞",
  "開く/動詞/一般",
  "読む/動詞/一般",
  "読み/動詞/一般=読む",
  "読ん/動詞/一般=読む",
  "選ぶ/動詞/一般",
  "だ/助動詞",
  ...Array.from({ length: 200 }, (_, i) => `項目${i}/名詞/普通名詞`),
]

/** A paragraph that repeats a few words, 設定 and 確認 most. */
const PARAGRAPH = [
  "色を選ぶ。",
  "設定を確認する。".repeat(15),
  "画面を開く。".repeat(5),
  "手順を読む。".repeat(2),
].join("")

/** `count` of the paragraphs, about 170 characters each. */
const paragraphs = (count: number) => Array.from({ length: count }, () => PARAGRAPH).join("\n\n")

/** A run of `です` that adds characters to a text and no content words. */
const filler = (chars: number) => `${"です".repeat(chars / 2)}。`

const find = (text: string) => readWith("lexical_repetition", text, LEXICON)

describe("lexical_repetition", () => {
  test("reports a long text that reuses a few words, once, at the word that comes most often", () => {
    const text = paragraphs(30)
    const [hit, ...rest] = find(text)
    expect(rest).toEqual([])
    expect(hit.text).toBe("設定")
    expect(hit.start).toBe(text.indexOf("設定"))
    expect(hit.reason).toMatch(/^MTLD \d+\.\d over 1[0-9]{3} content words, below 40: /)
    expect(hit.reason).toEndWith("the most repeated are 設定 (450), 確認 (450), 画面 (150)")
  })

  test("names an inflected word by its dictionary form, and counts its forms as one", () => {
    const forms = Array.from({ length: 100 }, () => "手順を読む。手順を読み、手順を読んだ。").join("\n\n")
    expect(find(`${forms}\n\n${filler(3000)}`)[0].reason).toContain("読む (300)")
  })

  test("is quiet for a text whose words are all different", () => {
    const pairs = Array.from({ length: 100 }, (_, i) => `項目${2 * i}項目${2 * i + 1}です。`).join("")
    expect(find(`${pairs}\n\n${filler(3000)}`)).toEqual([])
  })

  test("is quiet for a long text that returns to its words only after many others", () => {
    const sixty = Array.from({ length: 60 }, (_, i) => `項目${i}です。`).join("")
    expect(find(`${sixty.repeat(4)}\n\n${filler(3000)}`)).toEqual([])
  })

  test("needs 4,000 readable characters", () => {
    expect(find("設定を確認する。".repeat(499))).toEqual([])
    expect(find("設定を確認する。".repeat(500))).toHaveLength(1)
  })

  test("needs 100 content words", () => {
    const text = (sentences: number) => `${"設定を確認する。".repeat(sentences)}\n\n${filler(4000)}`
    expect(find(text(49))).toEqual([])
    expect(find(text(50))).toHaveLength(1)
  })

  test("counts neither numerals, pronouns nor the verb that only supports a noun as content words", () => {
    const text = (sentences: number) => `${"これは三つ設定する。".repeat(sentences)}\n\n${filler(4000)}`
    expect(find(text(99))).toEqual([])
    expect(find(text(100))[0].reason).toContain("over 100 content words")
  })

  test("sees only the blocks the engine read", () => {
    const text = paragraphs(30)
    expect(readWith("lexical_repetition", text, LEXICON, { only: [0, 1] })).toEqual([])
    expect(readWith("lexical_repetition", text, LEXICON, { only: [0, 1, 2, 3] })).toHaveLength(1)
  })

  test("reports nothing without tokens", () => {
    expect(readWith("lexical_repetition", paragraphs(30), undefined)).toEqual([])
  })

  test("can be excluded", () => {
    const given = { exclude_rules: ["lexical_repetition"] }
    expect(readWith("lexical_repetition", paragraphs(30), LEXICON, { given })).toEqual([])
  })
})
