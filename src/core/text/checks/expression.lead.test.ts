import { describe, expect, test } from "bun:test"
import { readWith } from "./expression.tokens.testing"

const LEXICON = [
  "この/連体詞",
  "その/連体詞",
  "設定/名詞/普通名詞",
  "値/名詞/普通名詞",
  "東京/名詞/固有名詞",
  "Git/名詞/普通名詞",
  "はい/感動詞",
  "しかし/接続詞",
  "…/補助記号/一般",
  ...Array.from({ length: 40 }, (_, i) => `項目${i}/名詞/普通名詞`),
]

/** `count` sentences, each opening with `lead` and ending in a different word, as one paragraph. */
function sentences(lead: string, count: number, from = 0): string {
  return Array.from({ length: count }, (_, i) => `${lead}項目${from + i}です。`).join("")
}

const find = (text: string, genre?: "essay" | "technical" | "business", only?: readonly number[]) =>
  readWith("repeated_lead", text, LEXICON, { given: genre === undefined ? {} : { genre }, only })

describe("repeated_lead", () => {
  test("reports an opening that six sentences share, once, at the opening of the first", () => {
    expect(find(sentences("この設定は", 6))).toEqual([
      {
        text: "この設定",
        start: 0,
        reason: '6 sentences open with "この設定"; a different opening for some may read less monotonous',
      },
    ])
    expect(find(sentences("この設定は", 5))).toEqual([])
  })

  test("counts the whole text, across its paragraphs", () => {
    const text = `${sentences("この設定は", 3)}\n\n${sentences("この設定は", 3, 3)}`
    expect(find(text).map((hit) => hit.text)).toEqual(["この設定"])
  })

  test.each([
    ["general", undefined, 6],
    ["essay", "essay", 5],
    ["technical", "technical", 7],
    ["business", "business", 7],
  ] as const)("holds %s text to its genre's number", (_name, genre, limit) => {
    expect(find(sentences("この設定は", limit - 1), genre)).toEqual([])
    expect(find(sentences("この設定は", limit), genre)).toHaveLength(1)
  })

  test("reports each opening that repeats, in the order the first of each comes", () => {
    const text = sentences("その値は", 6) + sentences("この設定は", 7, 6)
    expect(find(text).map((hit) => hit.text)).toEqual(["その値", "この設定"])
    expect(find(text).map((hit) => hit.reason.slice(0, 2))).toEqual(["6 ", "7 "])
  })

  test("keys a sentence of one word by that word, and leaves out the punctuation around the opening", () => {
    expect(find("はい。".repeat(6)).map((hit) => hit.text)).toEqual(["はい"])
    expect(find("しかし、項目1です。".repeat(6)).map((hit) => hit.text)).toEqual(["しかし、"])
    expect(find(sentences("…この設定は", 6)).map((hit) => hit.text)).toEqual(["この設定"])
  })

  test("is quiet for openings that vary", () => {
    const text = [sentences("この設定は", 5), sentences("その値は", 5, 5), sentences("しかし、", 5, 10)].join("")
    expect(find(text)).toEqual([])
  })

  test("leaves out an opening that is a proper noun or a Latin word", () => {
    expect(find(sentences("東京は", 7))).toEqual([])
    expect(find(sentences("Gitは", 7))).toEqual([])
    expect(find(sentences("東京の", 7))).toEqual([])
  })

  test("does not key on a masked unit: a sentence opening with code has no opening, and code ends the opening", () => {
    expect(find("`a`は項目1です。".repeat(7))).toEqual([])
    const text = Array.from({ length: 6 }, (_, i) => `この\`code${i}\`は項目${i}です。`).join("")
    expect(find(text).map((hit) => hit.text)).toEqual(["この"])
  })

  test("reads only the sentences of body text that end in a terminator", () => {
    const list = sentences("この設定は", 6).replaceAll("この設定は", "\n- この設定は")
    expect(find(list)).toEqual([])
    expect(find(`# この設定は項目1です。\n\n${sentences("この設定は", 5)}`)).toEqual([])
    expect(find(`${sentences("この設定は", 5)}この設定は項目1です`)).toEqual([])
  })

  test("sees only the blocks the engine read", () => {
    const text = `${sentences("この設定は", 3)}\n\n${sentences("この設定は", 3, 3)}`
    expect(find(text, undefined, [0])).toEqual([])
    expect(find(text, undefined, [0, 1])).toHaveLength(1)
  })

  test("reports nothing without tokens", () => {
    expect(readWith("repeated_lead", sentences("この設定は", 7), undefined)).toEqual([])
  })

  test("can be excluded", () => {
    const given = { exclude_rules: ["repeated_lead"] }
    expect(readWith("repeated_lead", sentences("この設定は", 7), LEXICON, { given })).toEqual([])
  })
})
