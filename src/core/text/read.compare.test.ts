import { describe, expect, test } from "bun:test"
import { isToolError } from "../errors"
import { invoke } from "../tool"
import { revise, WORDS_UNAVAILABLE } from "./checks/revision.testing"
import { MAX_TEXT_BYTES } from "./limits"
import { writingTextRead } from "./read"

const CTX = { cwd: process.cwd() }

async function refusal(promise: Promise<unknown>): Promise<{ code: unknown; message: string }> {
  try {
    await promise
  } catch (error) {
    if (isToolError(error)) return { code: error.code, message: error.message }
    throw error
  }
  throw new Error("expected a refusal")
}

describe("writing_text_read, method compare", () => {
  test("refuses a call without `original`, naming the argument", async () => {
    const result = await refusal(invoke(writingTextRead, { method: "compare", text: "a" }, CTX))
    expect(result.code).toBe("invalid_argument")
    expect(result.message).toContain("`original`")
  })

  test("refuses `original` for `inspect`, so a call never compares by accident", async () => {
    const result = await refusal(invoke(writingTextRead, { method: "inspect", text: "a", original: "b" }, CTX))
    expect(result.code).toBe("invalid_argument")
    expect(result.message).toContain("`original`")
  })

  test("refuses `checks`", async () => {
    const result = await refusal(
      invoke(writingTextRead, { method: "compare", text: "a", original: "b", checks: ["notation"] }, CTX),
    )
    expect(result.code).toBe("invalid_argument")
    expect(result.message).toContain("`checks`")
  })

  test("accepts an `original` of exactly the limit and refuses a byte more, naming the limit", async () => {
    const atLimit = "a".repeat(MAX_TEXT_BYTES)
    expect((await revise(atLimit, "a")).counts.total).toBe(0)
    const over = await refusal(revise(`${atLimit}a`, "a"))
    expect(over.code).toBe("invalid_argument")
    expect(over.message).toContain("`original`")
    expect(over.message).toContain(String(MAX_TEXT_BYTES))
  })

  test("counts the limit of `original` in bytes of UTF-8", async () => {
    const fits = "あ".repeat(Math.floor(MAX_TEXT_BYTES / 3))
    expect((await revise(fits, "あ")).counts.total).toBe(0)
    expect((await refusal(revise(`${fits}あ`, "あ"))).code).toBe("invalid_argument")
  })

  test("refuses a `text` over the limit, as `inspect` does", async () => {
    const over = await refusal(revise("a", "a".repeat(MAX_TEXT_BYTES + 1)))
    expect(over.message).toContain("`text`")
    expect(over.message).toContain(String(MAX_TEXT_BYTES))
  })

  test("reads two empty texts", async () => {
    expect((await revise("", "")).findings).toEqual([])
  })
})

describe("writing_text_read, the report of compare", () => {
  test("names the method and the one check that ran, and counts by that check", async () => {
    const report = await revise("価格は30円です。", "価格は20円です。")
    expect(report).toMatchObject({
      report_version: 1,
      method: "compare",
      checks: ["revision"],
      genre: "general",
      stance: null,
      not_run: WORDS_UNAVAILABLE,
    })
    expect(report.counts.by_check.revision).toEqual({ critical: 1, warn: 1, info: 0 })
    expect(report.counts.by_check.notation).toEqual({ critical: 0, warn: 0, info: 0 })
    expect(report.counts.total).toBe(2)
    expect(report.outline).toBeUndefined()
    expect(report.terms).toBeUndefined()
  })

  test("holds no convention to anything, whatever the settings say", async () => {
    const report = await revise("価格は30円です。", "価格は20円です。", {}, { register: "polite", quotes: "corner" })
    for (const convention of Object.values(report.conventions))
      expect(convention).toEqual({ value: null, source: "unset" })
  })

  test("keeps the most severe findings under `limit`, counts them all and says what it cut", async () => {
    const report = await revise("価格は30円です。", "価格は20円です。", { limit: 1 })
    expect(report.findings.map(({ rule }) => rule)).toEqual(["number_lost"])
    expect(report.counts.total).toBe(2)
    expect(report.cut).toEqual({ findings: 1 })
  })

  test("takes the genre and the stance it is given, and reports them", async () => {
    const report = await revise("a", "b", { genre: "technical", stance: "rule" })
    expect(report).toMatchObject({ genre: "technical", stance: "rule" })
  })
})

describe("writing_text_read, the rule lists of compare and inspect", () => {
  test("a `rules` or `exclude_rules` setting that names an inspect rule does not break compare", async () => {
    const options = { rules: ["emoji"], exclude_rules: ["long_sentence"] }
    const report = await revise("価格は30円です。", "価格は20円です。", {}, options)
    expect(report.counts.total).toBe(2)
  })

  test("a setting that names a revision rule does not break inspect, and turns nothing on there", async () => {
    const options = { rules: ["number_added"], exclude_rules: ["number_lost"] }
    const report = await invoke(writingTextRead, { method: "inspect", text: "価格は30円です。" }, { ...CTX, options })
    expect(report.findings).toEqual([])
    expect(report.counts.by_check.revision).toEqual({ critical: 0, warn: 0, info: 0 })
  })

  test("the arguments of either method may name the rules of either, and refuse an id no check has", async () => {
    expect((await revise("a", "b", { exclude_rules: ["long_sentence", "number_lost"] })).findings).toEqual([])
    const result = await refusal(revise("a", "b", { rules: ["nope"] }))
    expect(result.code).toBe("invalid_argument")
    expect(result.message).toContain("nope")
    const fromSetting = await refusal(revise("a", "b", {}, { exclude_rules: ["nope"] }))
    expect(fromSetting.message).toContain("setting")
  })

  test("`inspect` still runs its five checks, and `compare` only revision", async () => {
    const inspected = await invoke(writingTextRead, { method: "inspect", text: "これはテストです。" }, CTX)
    expect(inspected.checks).toEqual(["notation", "expression", "readability", "outline", "terms"])
    expect((await revise("a", "b")).checks).toEqual(["revision"])
  })
})
