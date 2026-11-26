import { describe, expect, test } from "bun:test"
import { hits, reasons, run } from "./notation.testing"

describe("quotes as a convention", () => {
  const text = "「確認」と「実行」と“停止”"

  test("is held to the text's majority, naming it and the counts", () => {
    expect(hits(text)).toEqual([["quotes", "“停止”"]])
    expect(reasons(text)).toEqual(["double here; the text mostly uses corner (2 to 1)"])
    expect(run(text).settled?.quotes).toBe("corner")
  })

  test("takes the kind that comes first as the majority on a tie", () => {
    expect(hits("“停止”と「確認」")).toEqual([["quotes", "「確認」"]])
  })

  test("is held to a given value, whatever the text does elsewhere", () => {
    expect(hits(text, { quotes: "double" })).toEqual([
      ["quotes", "「確認」"],
      ["quotes", "「実行」"],
    ])
    expect(reasons("「確認」", {}, { quotes: "double" })).toEqual(["uses corner where the setting expects double"])
    expect(run(text, { quotes: "double" }).settled?.quotes).toBeUndefined()
  })

  test("draws nothing from a text that uses one kind, and settles it", () => {
    expect(hits("「確認」と“API”と『書名』")).toEqual([])
    expect(run('“確認”と"実行"').settled?.quotes).toBe("double")
    expect(run("確認").settled?.quotes).toBeUndefined()
  })
})

describe("range_mark as a convention", () => {
  const text = "3〜5日、4〜6日、7～9日"

  test("is held to the text's majority, spanning the mark", () => {
    expect(hits(text)).toEqual([["range_mark", "～"]])
    expect(reasons(text)).toEqual(["fullwidth_tilde here; the text mostly uses wave_dash (2 to 1)"])
    expect(run(text).settled?.range_mark).toBe("wave_dash")
  })

  test("is held to a given value, so a hyphen between two numbers is a finding too", () => {
    expect(hits("3〜5日、4-6日、7–9日", { range_mark: "wave_dash" })).toEqual([
      ["range_mark", "-"],
      ["range_mark", "–"],
    ])
    expect(reasons("3～5日", {}, { range_mark: "hyphen" })).toEqual([
      "uses fullwidth_tilde where the setting expects hyphen",
    ])
  })

  test("draws nothing from dates, phone numbers or ASCII tildes beside a wave dash", () => {
    expect(hits("2026-11-26に3〜5日、03-1234-5678、1~2")).toEqual([])
  })
})

describe("long_vowel as a convention", () => {
  const text = "サーバーとユーザーとブラウザ"

  test("is held to the text's majority and names the other form of the word", () => {
    expect(hits(text)).toEqual([["long_vowel", "ブラウザ"]])
    expect(reasons(text)).toEqual(['drop here; the text mostly uses keep (2 to 1); the other form is "ブラウザー"'])
    expect(run(text).settled?.long_vowel).toBe("keep")
  })

  test("is held to a given value, naming the other form either way", () => {
    expect(reasons("サーバーとユーザ", { long_vowel: "drop" })).toEqual([
      'uses keep where the argument expects drop; the other form is "サーバ"',
    ])
    expect(reasons("サーバーとユーザ", {}, { long_vowel: "keep" })).toEqual([
      'uses drop where the setting expects keep; the other form is "ユーザー"',
    ])
  })

  test("draws nothing from a text that uses one form, from compounds, or from words not listed", () => {
    expect(hits("サーバとユーザとサーバサイド")).toEqual([])
    expect(hits("サーバーとサーバーサイドとメモリーカードとユーザビリティ")).toEqual([])
    expect(run("サーバとユーザ").settled?.long_vowel).toBe("drop")
  })
})

describe("counter_ka as a convention", () => {
  const text = "3か月、5か所、2ヶ月"

  test("is held to the text's majority, spanning the character", () => {
    expect(hits(text)).toEqual([["counter_ka", "ヶ"]])
    expect(reasons(text)).toEqual(["small_ke here; the text mostly uses hiragana (2 to 1)"])
    expect(run(text).settled?.counter_ka).toBe("hiragana")
  })

  test("is held to a given value, counting ヶ and ケ as one and カ and ヵ as one", () => {
    expect(hits("3ヶ月、3ケ月、3カ月、3ヵ月、3か月", { counter_ka: "small_ke" })).toEqual([
      ["counter_ka", "カ"],
      ["counter_ka", "ヵ"],
      ["counter_ka", "か"],
    ])
  })

  test("never reports a ケ that stands for 個", () => {
    expect(hits("3ケ、3ケース、3か月", { counter_ka: "hiragana" })).toEqual([])
  })
})

describe("the new convention rules", () => {
  const text = "「確認」と“停止”、3〜5日と6～7日、サーバーとユーザ、3か月と2ヶ月"

  test("each report their own minority, and settle their own convention", () => {
    expect(hits(text).map(([rule]) => rule)).toEqual(["quotes", "range_mark", "long_vowel", "counter_ka"])
    expect(run(text).settled).toMatchObject({
      quotes: "corner",
      range_mark: "wave_dash",
      long_vowel: "keep",
      counter_ka: "hiragana",
    })
  })

  test("are neither run nor settled once excluded", () => {
    const excluded = ["quotes", "range_mark", "long_vowel", "counter_ka"] as const
    expect(hits(text, { exclude_rules: [...excluded] })).toEqual([])
    for (const rule of excluded) {
      const result = run(text, { exclude_rules: [rule] })
      expect(result.findings.map((item) => item.rule)).not.toContain(rule)
      expect(result.settled?.[rule]).toBeUndefined()
    }
  })

  test("read prose, headings and list items, and never a quotation", () => {
    expect(hits("「確認」と「実行」\n\n# “停止”\n\n- “実行”")).toEqual([
      ["quotes", "“停止”"],
      ["quotes", "“実行”"],
    ])
    expect(hits("「確認」\n\n> “停止”\n> “実行”")).toEqual([])
  })
})
