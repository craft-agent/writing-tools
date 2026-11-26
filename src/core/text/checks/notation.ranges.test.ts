import { describe, expect, test } from "bun:test"
import { seen } from "./notation.testing"
import { findRangeMark } from "./ranges"

const marks = (text: string) => seen(findRangeMark, text)

describe("range_mark occurrences", () => {
  test("reads each mark between two numbers by its kind, spanning the mark", () => {
    expect(marks("3〜5日、3～5日、3-5日、3–5日")).toEqual([
      ["wave_dash", "〜"],
      ["fullwidth_tilde", "～"],
      ["hyphen", "-"],
      ["hyphen", "–"],
    ])
  })

  test("reads numbers of either width, with a decimal part", () => {
    expect(marks("１０〜２０")).toEqual([["wave_dash", "〜"]])
    expect(marks("１．５～２．５と1.5〜2.5と1.5-2.5")).toEqual([
      ["fullwidth_tilde", "～"],
      ["wave_dash", "〜"],
      ["hyphen", "-"],
    ])
  })

  test("reads a short unit after the first number, and spaces around the mark", () => {
    expect(marks("3時〜5時、10%〜20%、10MB〜20MB、約3人以上〜5人")).toEqual([
      ["wave_dash", "〜"],
      ["wave_dash", "〜"],
      ["wave_dash", "〜"],
      ["wave_dash", "〜"],
    ])
    expect(marks("3 〜 5と3　～　5と3 - 5")).toEqual([
      ["wave_dash", "〜"],
      ["fullwidth_tilde", "～"],
      ["hyphen", "-"],
    ])
  })

  test("never reads a unit of more than three characters, or one that holds punctuation", () => {
    expect(marks("3年間以上〜5")).toEqual([])
    expect(marks("3人、〜5")).toEqual([])
    expect(marks("3「人」〜5")).toEqual([])
  })

  test("reads every mark of a chain, and the middle of a date or a time", () => {
    expect(marks("1〜2〜3")).toEqual([
      ["wave_dash", "〜"],
      ["wave_dash", "〜"],
    ])
    expect(marks("2024年10月〜12月")).toEqual([["wave_dash", "〜"]])
    expect(marks("10:00-12:00")).toEqual([["hyphen", "-"]])
  })

  test("never reads an ASCII tilde, or a mark without a number on both sides", () => {
    expect(marks("3~5")).toEqual([])
    expect(marks("A〜B、3〜、〜5、3 - 日")).toEqual([])
  })

  test("never reads a hyphen that joins more than two numbers, as in a date or a phone number", () => {
    expect(marks("2026-11-26")).toEqual([])
    expect(marks("2026–11–26")).toEqual([])
    expect(marks("03-1234-5678")).toEqual([])
  })

  test("never reads a hyphen that a Latin letter touches, as in a model or a version", () => {
    expect(marks("x86-64とv1-2とISO-8601")).toEqual([])
    expect(marks("A4-5と1-2a")).toEqual([])
    expect(marks("`x`1-2")).toEqual([])
  })

  test("reads a wave dash or a tilde whatever touches it", () => {
    expect(marks("v1〜2と86～64")).toEqual([
      ["wave_dash", "〜"],
      ["fullwidth_tilde", "～"],
    ])
  })

  test("never reads a quotation or inline code", () => {
    expect(marks("> 3〜5")).toEqual([])
    expect(marks("`3〜5`")).toEqual([])
  })
})
