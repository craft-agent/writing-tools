import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./expression.testing"

/** A sentence of `length` characters, the terminator included, that ends in no ending the package lists. */
function sentence(length: number): string {
  return `${"あ".repeat(length - 1)}。`
}

describe("ending_repetition", () => {
  const find = (text: string) => matched("ending_repetition", text)
  const why = (text: string) => reasonsOf("ending_repetition", text)

  test("reports three sentences in a row with one ending, at the third ending", () => {
    expect(find("今日は晴れです。明日は雨です。週末は曇りです。")).toEqual(["です。"])
    expect(find("確認する。実行する。停止する。")).toEqual(["る。"])
    expect(why("今日は晴れです。明日は雨です。週末は曇りです。")).toEqual(['3 sentences in a row end in "です"'])
  })

  test("reports a longer run once, naming the whole run", () => {
    const text = "雨が降りました。風が吹きました。雪が積もりました。日が差しました。"
    expect(find(text)).toEqual(["ました。"])
    expect(why(text)).toEqual(['4 sentences in a row end in "ました"'])
  })

  test("reports each run of a paragraph", () => {
    expect(find("朝は晴れです。昼も晴れです。夜も晴れです。雨は降りません。風も吹きません。星も見えません。")).toEqual([
      "です。",
      "ません。",
    ])
  })

  test("reads the longest ending of the list", () => {
    expect(why("雨でした。風でした。雪でした。")).toEqual(['3 sentences in a row end in "でした"'])
    expect(why("雨だった。風だった。雪だった。")).toEqual(['3 sentences in a row end in "だった"'])
    expect(why("これは本である。あれは筆である。それは紙である。")).toEqual(['3 sentences in a row end in "である"'])
    expect(find("確認しました。確認します。確認しました。")).toEqual([])
  })

  test("leaves out what trails the wording, as register does", () => {
    expect(find("**雨です**。風です（注）。雪です」。")).toEqual(["です」。"])
  })

  test("is quiet when the endings differ or a sentence ends otherwise", () => {
    expect(find("今日は晴れです。雨が降ります。曇りです。")).toEqual([])
    expect(find("確認します。実行します。一覧。停止します。")).toEqual([])
    expect(find("確認する。実行する。停止する")).toEqual([])
  })

  test("counts the sentences of a paragraph, across its soft line breaks, and no others", () => {
    expect(find("設定を保存します。\n画面を閉じます。\n端末を再起動します。")).toEqual(["ます。"])
    expect(find("設定を保存します。画面を閉じます。\n\n端末を再起動します。")).toEqual([])
    expect(find("## 背景\n設定を保存します。画面を閉じます。\n")).toEqual([])
    expect(find("- 設定を保存します。\n- 画面を閉じます。\n- 端末を再起動します。")).toEqual([])
    expect(find("> 設定を保存します。画面を閉じます。端末を再起動します。")).toEqual([])
  })
})

describe("choppy_sentences", () => {
  const find = (text: string, genre?: "essay") =>
    matched("choppy_sentences", text, genre === undefined ? {} : { genre })
  const why = (text: string) => reasonsOf("choppy_sentences", text)
  const SHORT_RUN = "朝に家を出た。電車は空いていた。席に座った。本を開いた。"

  test("reports four short sentences in a row, once, at the first", () => {
    expect(find(SHORT_RUN)).toEqual(["朝に家を出た。"])
    expect(why(SHORT_RUN)).toEqual([
      "4 short sentences in a row, each within 22 characters, or 38 when no comma follows a connective",
    ])
  })

  test("reports a longer run once, naming its length", () => {
    expect(why(`${SHORT_RUN}外は明るかった。窓を開けた。`)[0]).toStartWith("6 short sentences in a row")
  })

  test("is quiet at three short sentences", () => {
    expect(find("朝に家を出た。電車は空いていた。席に座った。")).toEqual([])
  })

  test("takes five for an essay, and the same lengths for every genre", () => {
    expect(find(SHORT_RUN, "essay")).toEqual([])
    expect(find(`${SHORT_RUN}外は明るかった。`, "essay")).toEqual(["朝に家を出た。"])
  })

  test("counts a sentence up to 38 characters as short only when no connective is followed by a comma", () => {
    const plain = "当館は駅から徒歩五分の市立図書館で平日は二十時まで開館しています。"
    const linked = "当館は駅から徒歩五分の市立図書館で、平日は二十時まで開館しています。"
    expect(find(plain.repeat(4))).toEqual([plain])
    expect(find(linked.repeat(4))).toEqual([])
    expect(find(`${plain.repeat(3)}${linked}`)).toEqual([])
  })

  test("takes a comma after any listed connective as a clause link", () => {
    for (const connective of [
      "て",
      "で",
      "し",
      "が",
      "けれど",
      "ので",
      "から",
      "ため",
      "ながら",
      "ものの",
      "ば",
      "たら",
      "なら",
      "と",
    ]) {
      const linked = `当館は駅から徒歩五分の市立図書館${connective}、平日は二十時まで開館する。`
      expect(find(linked.repeat(4))).toEqual([])
    }
    expect(find("当館は駅から徒歩五分の市立図書館だ、平日は二十時まで開館する。".repeat(4))).toHaveLength(1)
  })

  test("is quiet when a long sentence breaks the run, and counts no sentence over 38 characters as short", () => {
    expect(find(`${sentence(10).repeat(3)}${sentence(39)}${sentence(10).repeat(3)}`)).toEqual([])
    expect(find(sentence(38).repeat(4))).toHaveLength(1)
    expect(find(sentence(39).repeat(4))).toEqual([])
  })

  test("does not join paragraphs, list items, or a sentence without a terminator", () => {
    expect(find(`${sentence(10).repeat(2)}\n\n${sentence(10).repeat(2)}`)).toEqual([])
    expect(find("- 封筒を買う。\n- 切手を貼る。\n- 宛名を書く。\n- 投函する。")).toEqual([])
    expect(find(`${sentence(10).repeat(3)}${"あ".repeat(9)}`)).toEqual([])
  })
})

describe("uniform_sentence_length", () => {
  const find = (text: string, genre?: "essay") =>
    matched("uniform_sentence_length", text, genre === undefined ? {} : { genre })
  const EVEN = "設定を確認して結果を保存します。"

  /** Sentences that alternate between two lengths, `count` of them. */
  function alternating(long: number, short: number, count: number): string {
    return Array.from({ length: count }, (_, index) => sentence(index % 2 === 0 ? long : short)).join("")
  }

  test("reports eight sentences of one length, at the first, with the variation, the count and the mean", () => {
    expect(find(EVEN.repeat(8))).toEqual([EVEN])
    expect(reasonsOf("uniform_sentence_length", EVEN.repeat(8))).toEqual([
      "sentence lengths vary little: a coefficient of variation of 0.00 over 8 sentences of 16.0 characters on average",
    ])
  })

  test("counts the sentences of all the paragraphs", () => {
    expect(find(`${EVEN.repeat(4)}\n\n${EVEN.repeat(4)}`)).toEqual([EVEN])
  })

  test("is quiet under eight sentences or with varied lengths", () => {
    expect(find(EVEN.repeat(7))).toEqual([])
    expect(find(alternating(40, 8, 8))).toEqual([])
  })

  test("does not count list items, headings, quotations or a sentence without a terminator", () => {
    expect(find(Array.from({ length: 8 }, () => `- ${EVEN}`).join("\n"))).toEqual([])
    expect(find(`${EVEN.repeat(7)}\n\n# ${EVEN}\n\n> ${EVEN}\n\n${EVEN.slice(0, -1)}`)).toEqual([])
  })

  test("takes 0.25 for most genres and 0.2 for an essay", () => {
    const text = alternating(39, 25, 8)
    expect(find(text)).toHaveLength(1)
    expect(find(text, "essay")).toEqual([])
    expect(find(alternating(40, 24, 8))).toEqual([])
    expect(find(alternating(40, 24, 8), "essay")).toEqual([])
  })
})
