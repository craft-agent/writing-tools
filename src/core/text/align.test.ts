import { describe, expect, test } from "bun:test"
import { alignSentences } from "./align"
import { readDocument } from "./document"

/** The alignment of an original and a revision, each given as the paragraphs it is written in. */
function align(original: readonly string[], revision: readonly string[]) {
  const before = readDocument(original.join("\n\n"))
  const after = readDocument(revision.join("\n\n"))
  return { before, after, alignment: alignSentences(before, after) }
}

/** The pairs as [original sentence text, revision sentence text, kind]. */
function pairsOf(original: readonly string[], revision: readonly string[]) {
  const { before, after, alignment } = align(original, revision)
  const text = (doc: typeof before, index: number) =>
    doc.text.slice(doc.sentences[index].start, doc.sentences[index].end)
  return alignment.pairs.map((pair) => [text(before, pair.original), text(after, pair.revision), pair.kind])
}

describe("alignSentences", () => {
  test("pairs every sentence of a text with itself as unchanged", () => {
    const text = ["猫が鳴く。犬が吠える。", "鳥が歌う。"]
    const { alignment } = align(text, text)
    expect(alignment.pairs.map(({ kind }) => kind)).toEqual(["unchanged", "unchanged", "unchanged"])
    expect(alignment.dropped).toEqual([])
    expect(alignment.added).toEqual([])
  })

  test("pairs a revised sentence with the one it came from as changed, by likeness", () => {
    expect(pairsOf(["価格は30円です。"], ["価格は20円です。"])).toEqual([
      ["価格は30円です。", "価格は20円です。", "changed"],
    ])
  })

  test("leaves a sentence that is not alike dropped, and a new one added", () => {
    const { alignment } = align(["猫が鳴く。", "価格は30円です。"], ["猫が鳴く。", "明日は雨が降るでしょう。"])
    expect(alignment.pairs).toEqual([{ original: 0, revision: 0, kind: "unchanged" }])
    expect(alignment.dropped).toEqual([1])
    expect(alignment.added).toEqual([1])
  })

  test("pairs changed sentences between two unchanged ones only, so a moved sentence pairs with nothing", () => {
    const { alignment } = align(
      ["一つ目の文です。", "二つ目の文です。", "三つ目の文です。"],
      ["二つ目の文です。", "三つ目の文です。", "一つ目の文です。"],
    )
    expect(alignment.pairs.map(({ kind }) => kind)).toEqual(["unchanged", "unchanged"])
    expect(alignment.dropped).toEqual([0])
    expect(alignment.added).toEqual([2])
  })

  test("pairs the likest sentences first and never crosses a pair", () => {
    const first = "新しい設定画面で保存先を選べます。"
    const second = "古い設定画面の保存先は選べません。"
    const { alignment } = align(
      [first, second],
      ["古い設定画面の保存先は選べませんでした。", "新しい設定画面で保存先を選べますか。"],
    )
    expect(alignment.pairs).toHaveLength(1)
    expect(alignment.dropped).toHaveLength(1)
    expect(alignment.added).toHaveLength(1)
  })

  test("takes the sentences of changed text in the gap between unchanged ones in order", () => {
    const result = pairsOf(
      ["始まり。", "価格は30円です。", "数は5個です。", "終わり。"],
      ["始まり。", "価格は20円です。", "数は9個です。", "終わり。"],
    )
    expect(result.map(([, , kind]) => kind)).toEqual(["unchanged", "changed", "changed", "unchanged"])
    expect(result[1][1]).toBe("価格は20円です。")
    expect(result[2][1]).toBe("数は9個です。")
  })

  test("reads code, width, spacing and line wrapping as no change", () => {
    expect(
      pairsOf(["`foo` を使う。Pythonで書く。"], ["`bar` を使う。Python で書く。"]).map(([, , kind]) => kind),
    ).toEqual(["unchanged", "unchanged"])
    expect(pairsOf(["10個ある。"], ["１０個ある。"]).map(([, , kind]) => kind)).toEqual(["unchanged"])
    expect(pairsOf(["これは\nテストです。"], ["これはテスト\nです。"]).map(([, , kind]) => kind)).toEqual(["unchanged"])
  })

  test("aligns the sentences of prose, list items and headings, and not quotations", () => {
    const { before, alignment } = align(
      ["# 見出し", "- 項目です。", "> 引用です。", "本文です。"],
      ["# 見出し", "- 項目です。", "> 別の引用です。", "本文です。"],
    )
    expect(alignment.pairs).toHaveLength(3)
    expect(alignment.dropped).toEqual([])
    expect(before.sentences.map(({ kind }) => kind)).toContain("quote")
  })
})

describe("alignSentences, places", () => {
  const ORIGINAL = ["一つ目です。", "二つ目の別の話です。", "三つ目です。", "四つ目です。"]
  const REVISION = ["一つ目です。", "三つ目です。", "四つ目です。", "五つ目です。"]

  test("tells how the sentence at an offset stands", () => {
    const { before, after, alignment } = align(ORIGINAL, REVISION)
    expect(alignment.statusAt("original", 0)).toBe("unchanged")
    expect(alignment.statusAt("original", before.text.indexOf("二つ目"))).toBe("unpaired")
    expect(alignment.statusAt("revision", after.text.indexOf("五つ目"))).toBe("unpaired")
    expect(alignment.statusAt("revision", after.text.indexOf("四つ目") + 1)).toBe("unchanged")
  })

  test("tells nothing for an offset outside every aligned sentence", () => {
    const { before, alignment } = align(
      ["本文です。", "| a | b |\n| --- | --- |\n| 1 | 2 |", "終わりです。"],
      ["本文です。", "終わりです。"],
    )
    expect(alignment.statusAt("original", before.text.indexOf("| 1"))).toBeUndefined()
  })

  test("places an offset at the start of the sentence paired with the one that holds it", () => {
    const { before, after, alignment } = align(ORIGINAL, REVISION)
    expect(alignment.placeOf(before.text.indexOf("四つ目") + 2)).toBe(after.text.indexOf("四つ目"))
    expect(alignment.placeOf(0)).toBe(0)
  })

  test("places an offset in a dropped sentence at the next sentence that has a pair", () => {
    const { before, after, alignment } = align(ORIGINAL, REVISION)
    expect(alignment.placeOf(before.text.indexOf("二つ目") + 3)).toBe(after.text.indexOf("三つ目"))
  })

  test("places an offset past the last pair at the end of the revision", () => {
    const { before, after, alignment } = align(["残る。", "消える。"], ["残る。", "別の文が増えた。"])
    expect(alignment.placeOf(before.text.indexOf("消える"))).toBe(after.text.length)
  })

  test("places an offset between sentences with the sentence after it", () => {
    const { before, after, alignment } = align(
      ["最初です。", "| a |\n| --- |", "最後です。"],
      ["最初です。", "最後です。"],
    )
    expect(alignment.placeOf(before.text.indexOf("| a"))).toBe(after.text.indexOf("最後"))
  })

  test("places everything at the end of an empty revision", () => {
    const { alignment } = align(["消える。"], [""])
    expect(alignment.placeOf(0)).toBe(0)
  })
})

describe("alignSentences on a long text", () => {
  test("aligns a text of three thousand sentences revised in many places, well under a second", () => {
    const sentences = Array.from({ length: 3000 }, (_, index) => `これは${index}番目の文章で、内容はまだ変わりません。`)
    const revised = sentences.map((sentence, index) =>
      index % 20 === 0 ? sentence.replace("変わりません", "少し変わります") : sentence,
    )
    revised.splice(1000, 3)
    revised.splice(2000, 0, "ここに新しい文が入ります。")
    const before = readDocument(sentences.join(""))
    const after = readDocument(revised.join(""))
    const started = performance.now()
    const { pairs, dropped, added } = alignSentences(before, after)
    expect(performance.now() - started).toBeLessThan(1000)
    expect(pairs.filter(({ kind }) => kind === "unchanged").length).toBeGreaterThan(2800)
    expect(pairs.filter(({ kind }) => kind === "changed").length).toBeGreaterThan(100)
    expect(dropped.length).toBeLessThan(10)
    expect(added.length).toBeLessThan(10)
  })
})
