import { describe, expect, test } from "bun:test"
import { compile, shorterOf, type Rewrite } from "./phrases"
import { STOCK_PHRASES } from "./stock"
import { TRANSLATIONESE } from "./translationese"

/** The entries that break the contract of a list: they do not match their sample, or their shorter wording is not shorter than the match. */
function breaches(list: readonly Rewrite[]): string[] {
  return list.flatMap((entry) => {
    const match = compile(entry.pattern).exec(entry.sample)
    if (match === null) return [`${entry.pattern}: no match for "${entry.sample}"`]
    const shorter = shorterOf(entry, match)
    return shorter.length < match[0].length ? [] : [`${entry.pattern}: "${shorter}" is not shorter than "${match[0]}"`]
  })
}

describe("the lists of stock phrases and translationese", () => {
  test("hold only entries that match their sample, with a wording shorter than the match", () => {
    expect(breaches(STOCK_PHRASES)).toEqual([])
    expect(breaches(TRANSLATIONESE)).toEqual([])
  })

  test("hold each pattern once, and no empty match", () => {
    for (const list of [STOCK_PHRASES, TRANSLATIONESE]) {
      const patterns = list.map(({ pattern }) => pattern)
      expect(new Set(patterns).size).toBe(patterns.length)
      for (const { pattern, sample } of list) expect(compile(pattern).exec(sample)?.[0]).not.toBe("")
    }
  })

  test("name no wording for an entry that gives a note instead", () => {
    for (const entry of [...STOCK_PHRASES, ...TRANSLATIONESE]) {
      if (entry.note !== undefined) expect(entry.shorter).toBe("")
    }
  })

  test("read the shorter wording from the ending the pattern captured", () => {
    const forms = (list: readonly Rewrite[], pattern: string, text: string): string => {
      const entry = list.find((item) => item.pattern.includes(pattern))
      const match = entry === undefined ? null : compile(entry.pattern).exec(text)
      return entry === undefined || match === null ? "" : shorterOf(entry, match)
    }
    expect(forms(STOCK_PHRASES, "返事を返", "返事を返す")).toBe("返事する")
    expect(forms(STOCK_PHRASES, "返事を返", "返事を返しました")).toBe("返事しました")
    expect(forms(TRANSLATIONESE, "を行", "設定を行った")).toBe("設定した")
    expect(forms(TRANSLATIONESE, "を行", "修正を行いました")).toBe("修正しました")
    expect(forms(TRANSLATIONESE, "可能(", "保存することが可能だ")).toBe("できる")
    expect(forms(TRANSLATIONESE, "可能(", "保存することが可能になる")).toBe("できるようになる")
  })
})
