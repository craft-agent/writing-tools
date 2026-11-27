import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./readability.testing"

const find = (text: string, given = {}, options = {}) => matched("kanji_run", text, given, options)
const why = (text: string, given = {}, options = {}) => reasonsOf("kanji_run", text, given, options)

describe("kanji_run", () => {
  test("reports more than 6 kanji in a row, once per run, spanning the run", () => {
    expect(find("情報処理技術を学ぶ。")).toEqual([])
    expect(find("情報処理技術者を募る。")).toEqual(["情報処理技術者"])
    expect(why("情報処理技術者を募る。")).toEqual([
      "7 kanji in a row, past 6; splitting the compound or writing part of it in hiragana may read lighter",
    ])
    expect(find("国際連合安全保障理事会と最高裁判所長官が出席した。")).toEqual([
      "国際連合安全保障理事会",
      "最高裁判所長官",
    ])
  })

  test("counts 々, 〆 and the ideographs of every extension as kanji", () => {
    expect(find("時々刻々変化量を測る。")).toEqual(["時々刻々変化量"])
    expect(find("〆切延長申請書類を出す。")).toEqual(["〆切延長申請書類"])
    expect(find("㐀㐁㐂㐃㐄㐅㐆を並べる。")).toEqual(["㐀㐁㐂㐃㐄㐅㐆"])
    expect(why("𠀀𠀁𠀂𠀃𠀄𠀅𠀆を並べる。")[0]).toStartWith("7 kanji in a row")
    expect(find("𠀀𠀁𠀂𠀃𠀄𠀅𠀆を並べる。")).toEqual(["𠀀𠀁𠀂𠀃𠀄𠀅𠀆"])
    expect(find("𠀀𠀁𠀂𠀃𠀄𠀅を並べる。")).toEqual([])
  })

  test("keeps the kanji numerals in a run but does not count them", () => {
    for (const text of [
      "十一月二十七日に会う。",
      "二〇二六年十一月二十七日に会う。",
      "三千五百万円を払う。",
      "九百九十九億九千九百九十九万円を払う。",
    ]) {
      expect(find(text), text).toEqual([])
    }
    expect(find("一般社団法人日本を調べる。")).toEqual(["一般社団法人日本"])
    expect(why("一般社団法人日本を調べる。")).toEqual([
      "7 kanji in a row, past 6; splitting the compound or writing part of it in hiragana may read lighter",
    ])
    expect(find("二〇二六年度情報処理技術者試験を受ける。")).toEqual(["二〇二六年度情報処理技術者試験"])
    expect(why("二〇二六年度情報処理技術者試験を受ける。")[0]).toStartWith("11 kanji in a row")
    expect(find("社団法人日本を調べる。")).toEqual([])
    expect(find("一社団法人日本を調べる。")).toEqual([])
    expect(find("一二三四五六七八九十を数える。", {}, { kanji_run: 4 })).toEqual([])
  })

  test("ends a run at hiragana, katakana, a long vowel mark, punctuation, a space or a Latin character", () => {
    for (const text of [
      "最高裁判の所長官が出席した。",
      "最高裁判ノ所長官が出席した。",
      "最高裁判ー所長官が出席した。",
      "最高裁判、所長官が出席した。",
      "最高裁判 所長官が出席した。",
      "最高裁判a所長官が出席した。",
      "最高裁判\n所長官が出席した。",
    ]) {
      expect(find(text), text).toEqual([])
    }
  })

  test("never reads masked text, and a masked run ends a run", () => {
    expect(find("`情報処理技術者`を読む。")).toEqual([])
    expect(find("最高裁判`x`所長官が出席した。")).toEqual([])
    expect(find("[情報処理技術者](https://example.com/情報処理技術者)を読む。")).toEqual(["情報処理技術者"])
  })

  test("reads body text and list items, not headings, tables, quotations or code", () => {
    expect(find("- 情報処理技術者を募る")).toEqual(["情報処理技術者"])
    expect(find("# 情報処理技術者")).toEqual([])
    expect(find("| 情報処理技術者 | b |\n| --- | --- |")).toEqual([])
    expect(find("> 情報処理技術者を募る。")).toEqual([])
    expect(find("```\n情報処理技術者\n```")).toEqual([])
  })

  test("is moved by the kanji_run setting, in every genre", () => {
    expect(find("経済政策案を示す。", {}, { kanji_run: 5 })).toEqual([])
    expect(find("経済政策案を示す。", {}, { kanji_run: 4 })).toEqual(["経済政策案"])
    expect(why("経済政策案を示す。", {}, { kanji_run: 4 })[0]).toStartWith("5 kanji in a row, past 4;")
    expect(find("情報処理技術者を募る。", {}, { kanji_run: 7 })).toEqual([])
    expect(find("経済政策案を示す。", { genre: "essay" }, { kanji_run: 4 })).toEqual(["経済政策案"])
    for (const genre of ["general", "technical", "business", "essay"] as const) {
      expect(find("情報処理技術を学ぶ。", { genre })).toEqual([])
      expect(find("情報処理技術者を募る。", { genre })).toEqual(["情報処理技術者"])
    }
  })

  test("is left out when exclude_rules names it", () => {
    expect(find("情報処理技術者を募る。", { exclude_rules: ["kanji_run"] })).toEqual([])
  })
})
