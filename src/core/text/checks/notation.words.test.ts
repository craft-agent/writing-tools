import { describe, expect, test } from "bun:test"
import { findCounterKa } from "./counters"
import { seen } from "./notation.testing"
import { findLongVowel, LONG_VOWEL_WORDS } from "./vowels"

const vowels = (text: string) => seen(findLongVowel, text)
const counters = (text: string) => seen(findCounterKa, text)

describe("long_vowel occurrences", () => {
  test("reads a listed word by whether it keeps its closing ー, spanning the word", () => {
    expect(vowels("サーバーとサーバ、ユーザーとユーザ")).toEqual([
      ["keep", "サーバー"],
      ["drop", "サーバ"],
      ["keep", "ユーザー"],
      ["drop", "ユーザ"],
    ])
  })

  test("reads a word beside Japanese that is not katakana, and a word between middle dots", () => {
    expect(vowels("このサーバーは遅い。サーバ側")).toEqual([
      ["keep", "サーバー"],
      ["drop", "サーバ"],
    ])
    expect(vowels("リーダー・ライター")).toEqual([
      ["keep", "リーダー"],
      ["keep", "ライター"],
    ])
  })

  test("never reads a word inside a longer katakana run", () => {
    expect(vowels("サーバーサイドとメモリーカードとユーザビリティ")).toEqual([])
    expect(vowels("ネットサーバーとサーバーネット")).toEqual([])
    expect(vowels("ヘッダーズ、ヘッダ")).toEqual([["drop", "ヘッダ"]])
  })

  test("never reads a word that is not listed, or one in inline code", () => {
    expect(vowels("ブラウザーとブラウザ、プリンタとコンピュータ")).toEqual([
      ["keep", "ブラウザー"],
      ["drop", "ブラウザ"],
      ["drop", "プリンタ"],
      ["drop", "コンピュータ"],
    ])
    expect(vowels("スマートフォンとアプリ")).toEqual([])
    expect(vowels("`サーバー`と`サーバ`")).toEqual([])
  })
})

describe("the long_vowel word list", () => {
  test("holds katakana words that end in ー", () => {
    for (const word of LONG_VOWEL_WORDS) expect(word, word).toMatch(/^[\u30A1-\u30FA\u30FC]+ー$/)
  })

  test("has no word twice, and no word whose shorter form is another word or ends in ー", () => {
    expect(new Set(LONG_VOWEL_WORDS).size).toBe(LONG_VOWEL_WORDS.length)
    for (const word of LONG_VOWEL_WORDS) {
      const shorter = word.slice(0, -1)
      expect(LONG_VOWEL_WORDS, shorter).not.toContain(shorter)
      expect(shorter.endsWith("ー"), shorter).toBe(false)
    }
  })

  test("is the size of a list of common words", () => {
    expect(LONG_VOWEL_WORDS.length).toBeGreaterThanOrEqual(50)
  })
})

describe("counter_ka occurrences", () => {
  test("reads か as hiragana, ヶ and ケ as small_ke, カ and ヵ as katakana, spanning the character", () => {
    expect(counters("3か月、3ヶ月、3ケ月、3カ月、3ヵ月")).toEqual([
      ["hiragana", "か"],
      ["small_ke", "ヶ"],
      ["small_ke", "ケ"],
      ["katakana", "カ"],
      ["katakana", "ヵ"],
    ])
  })

  test("reads digits of either width, kanji numerals, 何, 数 and 幾", () => {
    expect(counters("３か月と三ヶ所と十カ国と百か条と何か所と数カ月と幾ヶ年")).toEqual([
      ["hiragana", "か"],
      ["small_ke", "ヶ"],
      ["katakana", "カ"],
      ["hiragana", "か"],
      ["hiragana", "か"],
      ["katakana", "カ"],
      ["small_ke", "ヶ"],
    ])
  })

  test("reads each counter noun: 月 所 国 条 年", () => {
    expect(counters("2か月 2か所 2か国 2か条 2か年").map(([, text]) => text)).toHaveLength(5)
  })

  test("never reads a か without a numeral before it and a counter noun after it", () => {
    expect(counters("3ケ、3ケース、3か日、3か、か月、いつか月を見る")).toEqual([])
    expect(counters("3 か月")).toEqual([])
  })

  test("never reads a quotation or inline code", () => {
    expect(counters("> 3か月")).toEqual([])
    expect(counters("`3か月`")).toEqual([])
  })
})
