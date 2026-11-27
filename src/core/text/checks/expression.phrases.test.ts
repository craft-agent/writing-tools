import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./expression.testing"

describe("stock_phrase", () => {
  const find = (text: string) => matched("stock_phrase", text)

  test("reports a doubled expression, spanning the phrase, with the shorter wording", () => {
    expect(find("まず最初に設定を開きます。")).toEqual(["まず最初に"])
    expect(find("一番最初の手順と一番最後の手順です。")).toEqual(["一番最初", "一番最後"])
    expect(find("この項目は必ず必要になります。")).toEqual(["必ず必要"])
    expect(find("今現在の値を確認します。")).toEqual(["今現在"])
    expect(find("頭痛が痛い日は休みます。")).toEqual(["頭痛が痛"])
    expect(reasonsOf("stock_phrase", "まず最初に設定を開きます。")).toEqual(['"まず最初に": "まず" says the same'])
  })

  test("reports a verb that repeats its noun, in the form it stands in", () => {
    expect(find("急に違和感を感じる。")).toEqual(["違和感を感じる"])
    expect(reasonsOf("stock_phrase", "違和感を感じる。")).toEqual(['"違和感を感じる": "違和感がある" says the same'])
    expect(find("すぐに返事を返す。返事を返しました。")).toEqual(["返事を返す", "返事を返しました"])
    expect(reasonsOf("stock_phrase", "返事を返しました。")).toEqual([
      '"返事を返しました": "返事しました" says the same',
    ])
  })

  test("reports a later regret, but not one that follows an action", () => {
    expect(find("やらないとあとで後悔します。")).toEqual(["あとで後悔"])
    expect(find("急がないと後で後悔します。")).toEqual(["後で後悔"])
    expect(find("食べた後で後悔した。")).toEqual([])
    expect(find("その後で後悔した。最後で後悔した。")).toEqual([])
    expect(find("あとで後悔しないよう、後で後悔する前に決める。")).toEqual(["あとで後悔", "後で後悔"])
  })

  test("reports 各 with ごと, and says to keep one", () => {
    expect(find("各チームごとに報告します。")).toEqual(["各チームごと"])
    expect(reasonsOf("stock_phrase", "各チームごとに報告します。")).toEqual([
      '"各チームごと": say 各 or ごと, not both',
    ])
    expect(find("各メンバーが月ごとに報告します。")).toEqual([])
    expect(find("各チームの週ごとの数字を見ます。")).toEqual([])
    expect(find("各チームに、月ごとの数字を渡します。")).toEqual([])
  })

  test("reports an empty closer or opener only where it starts a sentence", () => {
    expect(find("以上です。いかがでしたか？")).toEqual(["いかがでしたか？"])
    expect(find("いかがでしたでしょうか。")).toEqual(["いかがでしたでしょうか"])
    expect(find("結論から言うと、移行は不要です。")).toEqual(["結論から言うと、"])
    expect(reasonsOf("stock_phrase", "結論から言うと、移行は不要です。")).toEqual(['"結論から言うと、" can go'])
    expect(find("旅行はいかがでしたか。")).toEqual([])
    expect(find("まとめると、結論から言うと、移行は不要です。")).toEqual([])
  })

  test("reports という形 after a noun, and leaves the keigo となっております to the writer", () => {
    expect(find("この欄は必須となっております。")).toEqual([])
    expect(find("返金という形になります。例外という形です。")).toEqual(["という形になります", "という形です"])
    expect(find("三回に分けるという形になります。")).toEqual([])
  })

  test("is quiet on the plain wording", () => {
    expect(find("最初に設定を開きます。")).toEqual([])
    expect(find("必ずしも必要ではありません。")).toEqual([])
    expect(find("一番大きい箱を最後に運びます。")).toEqual([])
    expect(find("今は現在の値を使います。")).toEqual([])
    expect(find("返事を待ちます。頭が痛い。")).toEqual([])
    expect(find("設定は必須です。")).toEqual([])
  })

  test("reads headings, list items and table rows, and no quotation", () => {
    expect(find("## まず最初に")).toEqual(["まず最初に"])
    expect(find("- 今現在の値")).toEqual(["今現在"])
    expect(find("| 今現在 | 値 |\n| --- | --- |\n| 一番最初 | 1 |")).toEqual(["今現在", "一番最初"])
    expect(find("> まず最初に設定を開く。")).toEqual([])
  })

  test("never matches masked text or across it", () => {
    expect(find("`まず最初に`を実行します。")).toEqual([])
    expect(find("まず`x`最初に設定します。")).toEqual([])
    expect(find("```\n今現在\n```\n\n[今現在](https://example.com/一番最初)")).toEqual(["今現在"])
  })
})

describe("translationese", () => {
  const find = (text: string) => matched("translationese", text)
  const why = (text: string) => reasonsOf("translationese", text)

  test("reports することができる after a noun, as できる", () => {
    expect(find("設定を確認することができます。")).toEqual(["することができ"])
    expect(why("確認することができる。")).toEqual(['"することができ": "でき" says the same'])
    expect(find("共有することができない。保存することができた。")).toEqual(["することができ", "することができ"])
  })

  test("reports ことができる after another verb, without naming the form", () => {
    expect(find("本を読むことができる。")).toEqual(["ことができ"])
    expect(why("魚を食べることができる。")).toEqual(['"ことができ": the potential form of the verb says the same'])
    expect(find("運動をすることができる。そうすることができる。")).toEqual(["ことができ", "ことができ"])
    expect(find("彼を愛することができる。")).toEqual(["ことができ"])
  })

  test("reports することが可能 with the ending it takes", () => {
    expect(find("変更することが可能です。")).toEqual(["することが可能です"])
    expect(why("変更することが可能です。")).toEqual(['"することが可能です": "できます" says the same'])
    expect(why("変更することが可能だ。")).toEqual(['"することが可能だ": "できる" says the same'])
    expect(why("変更することが可能になる。")).toEqual(['"することが可能になる": "できるようになる" says the same'])
    expect(find("変更することが可能だった。")).toEqual([])
  })

  test("reports することによって, することを可能にする and という点において", () => {
    expect(why("再起動することによって直る。")).toEqual(['"することによって": "することで" says the same'])
    expect(why("共有することを可能にする。")).toEqual(['"することを可能にする": "できるようにする" says the same'])
    expect(why("速度という点において優れる。")).toEqual(['"という点において": "の点で" says the same'])
    expect(find("安全であるという点において優れる。")).toEqual([])
  })

  test("reports a noun with を行う, in the form it stands in", () => {
    expect(find("確認を行います。設定を行った。")).toEqual(["確認を行います", "設定を行った"])
    expect(why("確認を行います。")).toEqual(['"確認を行います": "確認します" says the same'])
    expect(why("更新を行いました。")).toEqual(['"更新を行いました": "更新しました" says the same'])
    expect(why("調査を行うため。")).toEqual(['"調査を行う": "調査する" says the same'])
    expect(find("調査を行わない。会議を行う。")).toEqual([])
  })

  test("is quiet on the plain wording", () => {
    expect(find("確認できます。")).toEqual([])
    expect(find("読める。できる。")).toEqual([])
    expect(find("設定は変更できるようになる。")).toEqual([])
    expect(find("確認することが大切です。")).toEqual([])
  })

  test("never matches masked text or a quotation", () => {
    expect(find("`確認することができる`と書く。")).toEqual([])
    expect(find("確認`を`行います。")).toEqual([])
    expect(find("> 確認することができる。")).toEqual([])
    expect(find("- 確認することができる")).toEqual(["することができ"])
  })
})
