import { describe, expect, test } from "bun:test"
import { invoke } from "../../tool"
import { writingTextRead } from "../read"

const CTX = { cwd: process.cwd() }

const TEXT = ["日本語 Python を使う、そして。", "日本語 Ruby を使う。", "日本語Go を使う，また。", "ﾃｽﾄです。"].join(
  "\n",
)

describe("writing_text_read with the notation rules", () => {
  test("reports each finding with its reference, and the conventions the text settled", async () => {
    const report = await invoke(writingTextRead, { method: "inspect", text: TEXT, checks: ["notation"] }, CTX)
    expect(report.findings.map(({ rule, line, column, reference }) => [rule, line, column, reference])).toEqual([
      ["latin_spacing", 3, 3, "notation.md#latin_spacing"],
      ["punctuation", 3, 10, "notation.md#punctuation"],
      ["halfwidth_katakana", 4, 1, "notation.md#halfwidth_katakana"],
    ])
    expect(report.findings[0]).toMatchObject({
      check: "notation",
      severity: "warn",
      reason: "unspaced here; the text mostly uses spaced (5 to 1)",
    })
    expect(report.counts.by_check.notation).toEqual({ critical: 0, warn: 3, info: 0 })
    expect(report.conventions.latin_spacing).toEqual({ value: "spaced", source: "document" })
    expect(report.conventions.alnum_width).toEqual({ value: "halfwidth", source: "document" })
    expect(report.conventions.punctuation).toEqual({ value: "ten_maru", source: "document" })
    expect(report.conventions.unit_spacing).toEqual({ value: null, source: "unset" })
    expect(report.conventions.bracket_width).toEqual({ value: null, source: "unset" })
  })

  test("holds the text to an argument or a setting, and reports it as the source", async () => {
    const asked = await invoke(
      writingTextRead,
      { method: "inspect", text: TEXT, checks: ["notation"], latin_spacing: "unspaced" },
      { ...CTX, options: { punctuation: "comma_maru" } },
    )
    expect(asked.conventions.latin_spacing).toEqual({ value: "unspaced", source: "argument" })
    expect(asked.conventions.punctuation).toEqual({ value: "comma_maru", source: "setting" })
    expect(asked.findings.filter(({ rule }) => rule === "latin_spacing")).toHaveLength(5)
  })

  test("settles nothing for a check that was not asked for, or a rule that was excluded", async () => {
    const other = await invoke(writingTextRead, { method: "inspect", text: TEXT, checks: ["expression"] }, CTX)
    expect(other.conventions.latin_spacing).toEqual({ value: null, source: "unset" })
    const excluded = await invoke(
      writingTextRead,
      { method: "inspect", text: TEXT, exclude_rules: ["latin_spacing", "choppy_sentences"] },
      CTX,
    )
    expect(excluded.conventions.latin_spacing).toEqual({ value: null, source: "unset" })
    expect(excluded.findings.map(({ rule }) => rule)).toEqual(["punctuation", "halfwidth_katakana", "register"])
  })
})
