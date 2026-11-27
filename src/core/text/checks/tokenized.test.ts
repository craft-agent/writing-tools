import { describe, expect, test } from "bun:test"
import type { Token } from "../../engine/tokens"
import { readDocument } from "../document"
import { tokensOf } from "./expression.tokens.testing"
import { readableTokens, sentenceTokens } from "./tokenized"

const LEXICON = ["この/連体詞", "設定/名詞/普通名詞", "値/名詞/普通名詞", "は/助詞/係助詞"]

const surfaces = (tokens: readonly Token[]) => tokens.map(({ surface }) => surface)

describe("readableTokens", () => {
  test("drops the blank tokens the engine reads over a masked unit or a line break", () => {
    const doc = readDocument("この`code`設定\nは値です。")
    const all = tokensOf(doc, LEXICON).get(0)!
    expect(all.filter(({ pos }) => pos[0] === "空白")).toHaveLength(2)
    expect(surfaces(readableTokens(doc, tokensOf(doc, LEXICON)).get(0)!)).toEqual([
      "この",
      "設定",
      "は",
      "値",
      "です",
      "。",
    ])
  })

  test("drops a token whose surface is not what the text holds at its place", () => {
    const doc = readDocument("この設定です。")
    const [first, ...rest] = tokensOf(doc, LEXICON).get(0)!
    const moved = { ...first, start: first.start + 1, end: first.end + 1 }
    expect(surfaces(readableTokens(doc, new Map([[0, [moved, ...rest]]])).get(0)!)).toEqual(["設定", "です", "。"])
  })

  test("keeps the blocks apart, and none that the engine did not read", () => {
    const doc = readDocument("この設定です。\n\n# 値\n\n値です。")
    expect([...readableTokens(doc, tokensOf(doc, LEXICON)).keys()]).toEqual([0, 2])
  })
})

describe("sentenceTokens", () => {
  const doc = readDocument("この設定は値です。値です。\n\n設定です。")
  const tokens = tokensOf(doc, LEXICON)

  test("gives each sentence the tokens that start in it", () => {
    const found = sentenceTokens(doc, tokens, doc.sentences)
    expect(found.map((item) => surfaces(item.tokens))).toEqual([
      ["この", "設定", "は", "値", "です", "。"],
      ["値", "です", "。"],
      ["設定", "です", "。"],
    ])
    expect(found.map((item) => item.sentence)).toEqual([...doc.sentences])
  })

  test("leaves out a sentence of a block the engine did not read", () => {
    const only = tokensOf(doc, LEXICON, [1])
    expect(sentenceTokens(doc, only, doc.sentences).map((item) => surfaces(item.tokens)[0])).toEqual(["設定"])
  })

  test("leaves out a sentence with no readable token, and reads only the sentences it is given", () => {
    expect(sentenceTokens(doc, new Map(), doc.sentences)).toEqual([])
    expect(sentenceTokens(doc, tokens, doc.sentences.slice(1, 2)).map((item) => surfaces(item.tokens)[0])).toEqual([
      "値",
    ])
  })
})
