import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { numbersOf } from "./numbers"
import { valueOf } from "./numerals"

/** The values of the numbers of a text, in order of position. */
function values(text: string): string[] {
  return numbersOf(readDocument(text)).map(({ key }) => key)
}

describe("valueOf", () => {
  test("reads digits of either width, comma grouping and a decimal part as one value", () => {
    expect(valueOf("1,000")).toBe("1000")
    expect(valueOf("１，０００")).toBe("1000")
    expect(valueOf("１０００")).toBe("1000")
    expect(valueOf("3.50")).toBe("3.5")
    expect(valueOf("３．１４")).toBe("3.14")
    expect(valueOf("007")).toBe("7")
    expect(valueOf("0")).toBe("0")
  })

  test("reads kanji numerals built from 十 百 千 and 万 億 兆", () => {
    expect(valueOf("三千五百万")).toBe("35000000")
    expect(valueOf("十二")).toBe("12")
    expect(valueOf("二十")).toBe("20")
    expect(valueOf("千万")).toBe("10000000")
    expect(valueOf("百")).toBe("100")
    expect(valueOf("一億二千万")).toBe("120000000")
    expect(valueOf("三兆")).toBe("3000000000000")
  })

  test("reads a kanji numeral of nothing but digits digit by digit", () => {
    expect(valueOf("二〇二六")).toBe("2026")
    expect(valueOf("〇")).toBe("0")
    expect(valueOf("一二三")).toBe("123")
  })

  test("reads digits with 万, 億 and the like, and mixes of both", () => {
    expect(valueOf("3万")).toBe("30000")
    expect(valueOf("3.5万")).toBe("35000")
    expect(valueOf("2億")).toBe("200000000")
    expect(valueOf("3万5,000")).toBe("35000")
    expect(valueOf("1億2千万")).toBe("120000000")
  })
})

describe("numbersOf", () => {
  test("finds digits of either width and gives each its value", () => {
    expect(values("価格は30円、１０００個、1,000人、2.5倍です。")).toEqual(["30", "1000", "1000", "2.5"])
  })

  test("reads 1,000 and １０００ and a kanji numeral before a unit as one number", () => {
    expect(new Set(values("1,000円と１０００円と千円"))).toEqual(new Set(["1000"]))
  })

  test("reads a kanji numeral only before a unit or a counter", () => {
    expect(values("三千五百万円で二〇二六年に十人が来た。")).toEqual(["35000000", "2026", "10"])
    expect(values("一般に統一された一部の一緒の意見。")).toEqual([])
    expect(values("第一章と二つの案、三か月。")).toEqual(["1", "2", "3"])
  })

  test("leaves out the words 一番 and 十分, but not 十分間", () => {
    expect(values("一番よい。十分に話した。")).toEqual([])
    expect(values("十分間待つ。二十分待つ。")).toEqual(["10", "20"])
  })

  test("leaves out a 一 that a kanji makes a word of, such as 同一人物 and 唯一の", () => {
    expect(values("同一人物が唯一人。")).toEqual([])
  })

  test("reads a multiplier with no digit of its own as a number only when it stands for one", () => {
    expect(values("万人が千円で百回。")).toEqual(["1000", "100"])
  })

  test("reads digits followed by 万 or 億 as the number they write", () => {
    expect(values("3万円と2億人。")).toEqual(["30000", "200000000"])
  })

  test("reads a date or a time as the numbers it is written with", () => {
    expect(values("2026年11月27日の10:30。")).toEqual(["2026", "11", "27", "10", "30"])
    expect(values("二〇二六年十一月二十七日")).toEqual(["2026", "11", "27"])
  })

  test("leaves out digits that are part of a Latin word or an identifier", () => {
    expect(values("HTTP2とA4用紙、iPhone15、x86。")).toEqual([])
    expect(values("Windows 11 と Python 3.12。")).toEqual(["11", "3.12"])
  })

  test("splits what is not comma grouping", () => {
    expect(values("1,2,3 と 12,34")).toEqual(["1", "2", "3", "12", "34"])
  })

  test("gives the span of the numeral as written, without its unit", () => {
    const doc = readDocument("残りは三千円です。")
    const [use] = numbersOf(doc)
    expect(doc.text.slice(use.start, use.end)).toBe("三千")
    expect(use.form).toBe("三千")
  })

  test("never reads masked text, quotations or links", () => {
    expect(values("`30円` と [20円](https://example.com/30) と\n\n> 50円\n\n```\n40円\n```")).toEqual(["20"])
  })

  test("reads a table row and a heading", () => {
    expect(values("# 第3章\n\n| 項目 | 値 |\n| --- | --- |\n| 数 | 5個 |")).toEqual(["3", "5"])
  })
})
