import { describe, expect, test } from "bun:test"
import { alignSentences } from "../align"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import { checkContext } from "../rules.testing"
import { selectRules } from "../selection"
import { tokensOf } from "./expression.tokens.testing"
import { revisionCheck } from "./revision"

/** The words the texts of these tests are made of, with the dictionary and normalized forms the engine would give. */
const LEXICON = [
  "古い/形容詞/一般",
  "画面/名詞/普通名詞",
  "設定/名詞/普通名詞",
  "閉じ/動詞/一般=閉じる",
  "閉じる/動詞/一般",
  "開い/動詞/一般=開く",
  "開く/動詞/一般",
  "た/助動詞",
  "こと/名詞/普通名詞",
  "ある/動詞/一般=ある=有る",
  "ため/名詞/普通名詞=ため=為",
  "行なう/動詞/一般=行なう=行う",
  "行う/動詞/一般",
  "前/名詞/普通名詞",
  "後/名詞/普通名詞",
  "30/名詞/数詞",
  "20/名詞/数詞",
  "円/名詞/助数詞",
  "7/名詞/普通名詞",
  "GitHub/名詞/固有名詞",
  "サーバー/名詞/普通名詞",
  "使う/動詞/一般",
]

/** Which blocks of each text the fake engine read; absent, all of them. */
type Read = { revision?: readonly number[]; original?: readonly number[] }

/** The rule and the reason of each content word finding of a revision, as the check finds them given the tokens of `LEXICON`. */
function wordsOf(
  original: string,
  revision: string,
  { exclude = [], read = {} }: { exclude?: string[]; read?: Read } = {},
) {
  const before = readDocument(original)
  const after = readDocument(revision)
  const given = { exclude_rules: exclude }
  const ctx = checkContext({
    doc: after,
    conventions: resolveConventions({}),
    enabled: selectRules(given, {}, [revisionCheck]),
    tokens: tokensOf(after, LEXICON, read.revision),
    comparison: {
      original: before,
      alignment: alignSentences(before, after),
      originalTokens: tokensOf(before, LEXICON, read.original),
    },
  })
  return revisionCheck
    .run(ctx)
    .findings.filter(({ rule }) => rule.startsWith("content_word_"))
    .map(({ rule, reason }) => [rule, reason])
}

describe("the revision check, content words", () => {
  test("declares two rules that need morphology, on by default, at info", () => {
    for (const id of ["content_word_lost", "content_word_added"]) {
      expect(revisionCheck.rules.find((rule) => rule.id === id)).toMatchObject({
        check: "revision",
        severity: "info",
        defaultOn: true,
        morphology: true,
        reference: `revision.md#${id}`,
      })
    }
  })

  test("finds a content word the revision lost and one it added", () => {
    expect(wordsOf("古い画面を閉じる。", "画面を閉じる。")).toEqual([
      ["content_word_lost", '"古い" is in the original but not in the revision'],
    ])
    expect(wordsOf("画面を閉じる。", "古い画面を閉じる。")).toEqual([
      ["content_word_added", '"古い" is in the revision but not in the original'],
    ])
  })

  test("reads a respelt word as the same word, so a spelling-only change finds nothing", () => {
    expect(wordsOf("画面を行なう。", "画面を行う。")).toEqual([])
  })

  test("names a word by its normalized form and shows how it was written when that differs", () => {
    expect(wordsOf("画面を行なう。", "画面を開く。")).toEqual([
      ["content_word_lost", '"行う" (written 行なう) is in the original but not in the revision'],
      ["content_word_added", '"開く" is in the revision but not in the original'],
    ])
  })

  test("reads an inflected word as its plain form and shows how it was written when that differs", () => {
    expect(wordsOf("画面を閉じた。", "画面を閉じる。")).toEqual([])
    expect(wordsOf("画面を閉じた。", "画面を開いた。")).toEqual([
      ["content_word_lost", '"閉じる" (written 閉じ) is in the original but not in the revision'],
      ["content_word_added", '"開く" (written 開い) is in the revision but not in the original'],
    ])
  })

  test("leaves numbers, and tokens that hold a digit, to the number rules", () => {
    expect(wordsOf("画面は30円です。", "画面は20円です。")).toEqual([])
    expect(wordsOf("画面は7です。", "画面です。")).toEqual([])
  })

  test("leaves names to the name rules, whatever the engine made of them", () => {
    expect(wordsOf("GitHub を使う。", "を使う。")).toEqual([])
    expect(wordsOf("サーバーを使う。", "を使う。")).toEqual([])
    expect(wordsOf("画面を使う。", "GitHub で画面を使う。")).toEqual([])
  })

  test("ignores the light words, in kana or in kanji, but not 前 and 後", () => {
    expect(wordsOf("画面を閉じることがある。", "画面を閉じる。")).toEqual([])
    expect(wordsOf("画面を閉じるため。", "画面を閉じる。")).toEqual([])
    expect(wordsOf("前に閉じる。", "後に閉じる。").map(([, reason]) => reason)).toEqual([
      '"前" is in the original but not in the revision',
      '"後" is in the revision but not in the original',
    ])
  })

  test("finds nothing when a sentence only moved or the text is unchanged", () => {
    expect(wordsOf("画面を閉じる。設定を開く。", "設定を開く。画面を閉じる。")).toEqual([])
    expect(wordsOf("古い画面を閉じる。", "古い画面を閉じる。")).toEqual([])
  })

  test("reports a word once, with the count of the uses that differ", () => {
    const original = "古い画面を閉じる。古い設定を閉じる。"
    expect(wordsOf(original, "画面を閉じる。設定を閉じる。")).toEqual([
      ["content_word_lost", '"古い" is in the original but not in the revision (2 uses)'],
    ])
  })

  test("is left out when exclude_rules names it", () => {
    const rules = wordsOf("古い画面を閉じる。", "設定を閉じる。", { exclude: ["content_word_added"] })
    expect(new Set(rules.map(([rule]) => rule))).toEqual(new Set(["content_word_lost"]))
  })

  test("reports nothing while the engine read only part of either text", () => {
    const original = "古い画面を閉じる。\n\n設定を開く。"
    const revision = "画面を閉じる。\n\n設定を開く。"
    expect(wordsOf(original, revision)).toHaveLength(1)
    expect(wordsOf(original, revision, { read: { revision: [0] } })).toEqual([])
    expect(wordsOf(original, revision, { read: { original: [1] } })).toEqual([])
  })
})
