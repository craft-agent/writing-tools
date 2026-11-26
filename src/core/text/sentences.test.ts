import { describe, expect, test } from "bun:test"
import { readDocument } from "./document"
import { sentencesOf } from "./document.testing"

describe("sentences", () => {
  test("end after 。 ！ ？ and ．", () => {
    expect(sentencesOf("一つ目。二つ目！三つ目？四つ目．")).toEqual([
      ["一つ目。", "。"],
      ["二つ目！", "！"],
      ["三つ目？", "？"],
      ["四つ目．", "．"],
    ])
  })

  test("run across a soft line break", () => {
    expect(sentencesOf("これは長い\n文です。次の\n文。")).toEqual([
      ["これは長い\n文です。", "。"],
      ["次の\n文。", "。"],
    ])
    expect(sentencesOf("折り返した\r\n文です。")).toEqual([["折り返した\r\n文です。", "。"]])
  })

  test("end at a blank line, a heading, a list item, a table or a quotation", () => {
    expect(sentencesOf("一\n\n二\n# 三\n四\n- 五\n> 六\n七")).toEqual([
      ["一", null],
      ["二", null],
      ["三", null],
      ["四", null],
      ["五", null],
      ["六\n七", null],
    ])
  })

  test("do not end inside brackets and quotes", () => {
    expect(sentencesOf("「はい。」と答えた。次です。")).toEqual([
      ["「はい。」と答えた。", "。"],
      ["次です。", "。"],
    ])
    expect(sentencesOf("彼は『なに？』と言った（本当。）。終わり。")).toEqual([
      ["彼は『なに？』と言った（本当。）。", "。"],
      ["終わり。", "。"],
    ])
    expect(sentencesOf("(Yes. No.) だ。")).toEqual([["(Yes. No.) だ。", "。"]])
  })

  test("take the closing brackets and quotes after a terminator into the sentence", () => {
    expect(sentencesOf("（注です。）次。")).toEqual([["（注です。）次。", "。"]])
    expect(sentencesOf("彼は言った。」次。")).toEqual([
      ["彼は言った。」", "。"],
      ["次。", "。"],
    ])
    expect(sentencesOf("終わり。”】 次。")).toEqual([
      ["終わり。”】", "。"],
      ["次。", "。"],
    ])
  })

  test("end at ! and ? only before a space, the end of a line or a non-ASCII character", () => {
    expect(sentencesOf("Really? Yes! 本当?はい!\nOK?\nnext")).toEqual([
      ["Really?", "?"],
      ["Yes!", "!"],
      ["本当?", "?"],
      ["はい!", "!"],
      ["OK?", "?"],
      ["next", null],
    ])
    expect(sentencesOf("a?b=1&c!=2 `x? y` end")).toEqual([["a?b=1&c!=2 `x? y` end", null]])
    expect(sentencesOf("ほんとう!?次")).toEqual([
      ["ほんとう!?", "?"],
      ["次", null],
    ])
  })

  test("end a block's last sentence without a terminator", () => {
    expect(sentencesOf("終わった。続きがある")).toEqual([
      ["終わった。", "。"],
      ["続きがある", null],
    ])
  })

  test("leave a lone terminator as a sentence", () => {
    expect(sentencesOf("。")).toEqual([["。", "。"]])
  })

  test("read list items, list continuations and quotations from after their markers", () => {
    expect(sentencesOf("- [ ] 項目です。続き\n  です。\n1. 番号\n> 引用。")).toEqual([
      ["項目です。", "。"],
      ["続き\n  です。", "。"],
      ["番号", null],
      ["引用。", "。"],
    ])
  })

  test("take a heading as one sentence without its markers and closing hashes", () => {
    expect(sentencesOf("## まとめ ##\n\n# 完了。次\n\nタイトル？\n===")).toEqual([
      ["まとめ", null],
      ["完了。次", null],
      ["タイトル？", "？"],
    ])
  })

  test("give a table row no sentence", () => {
    expect(sentencesOf("| a | b。 |\n| --- | --- |\n| 1。 | 2 |")).toEqual([])
  })

  test("trim whitespace and masked spans at the edges, and keep the ones inside", () => {
    const text = "`code` 説明です。  <!-- c -->  [リンク](https://example.com) と https://example.com 。 `x`"
    expect(sentencesOf(text)).toEqual([
      ["説明です。", "。"],
      ["[リンク](https://example.com) と https://example.com 。", "。"],
    ])
    expect(sentencesOf("`a` `b`\n\n本文")).toEqual([["本文", null]])
    expect(sentencesOf("文です `x`")).toEqual([["文です", null]])
    expect(sentencesOf("`x` を使う `y` 文です `z`")).toEqual([["を使う `y` 文です", null]])
  })

  test("never read what is masked", () => {
    expect(sentencesOf("---\ntitle: a。\n---\n```\nx。\n```\n    y。\n本文")).toEqual([["本文", null]])
    expect(sentencesOf("[x]: https://example.com/a。b")).toEqual([])
  })

  test("carry the kind of the block", () => {
    const doc = readDocument("# 見出し\n本文。\n- 項目。\n> 引用。")
    expect(doc.sentences.map((sentence) => sentence.kind)).toEqual(["heading", "prose", "list", "quote"])
  })

  test("read a text of no sentences", () => {
    expect(sentencesOf("")).toEqual([])
    expect(sentencesOf("\n\n  \n")).toEqual([])
  })
})
