import { describe, expect, test } from "bun:test"
import { DEFAULT_LIMIT } from "./limits"
import { readDocument } from "./document"
import { inspect } from "./inspect"
import { fakeCheck, found, rule } from "./rules.testing"
import type { CheckContext, CheckSpec } from "./rules"
import type { TextReadInput } from "./schemas"

const CALL: TextReadInput = { method: "inspect", text: "abcdef" }

function recording(): { seen: CheckContext[]; checks: CheckSpec[] } {
  const seen: CheckContext[] = []
  const check = (name: "notation" | "expression", rules: ReturnType<typeof rule>[], offset: number): CheckSpec => ({
    name,
    rules,
    run(ctx) {
      seen.push(ctx)
      return { findings: rules.filter((item) => ctx.enabled(item.id)).map((item) => found(item.id, offset)) }
    },
  })
  return {
    seen,
    checks: [
      check("expression", [rule("e_rule", { check: "expression" })], 3),
      check("notation", [rule("n_rule"), rule("n_off", { defaultOn: false })], 1),
    ],
  }
}

describe("inspect", () => {
  test("runs every check when `checks` is left out, in the order of the checks list", async () => {
    const { checks } = recording()
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks)
    expect(report.checks).toEqual(["notation", "expression"])
    expect(report.findings.map((item) => item.rule)).toEqual(["n_rule", "e_rule"])
  })

  test("runs only the checks asked for, once each, and echoes them", async () => {
    const { checks, seen } = recording()
    const report = await inspect(readDocument(CALL.text), { ...CALL, checks: ["expression", "expression"] }, {}, checks)
    expect(report.checks).toEqual(["expression"])
    expect(seen).toHaveLength(1)
    expect(report.findings.map((item) => item.rule)).toEqual(["e_rule"])
  })

  test("gives each check the document, the resolved conventions and the rules that are on", async () => {
    const { checks, seen } = recording()
    const doc = readDocument(CALL.text)
    await inspect(
      doc,
      { ...CALL, register: "polite", rules: ["n_off"], exclude_rules: ["e_rule"] },
      { quotes: "corner" },
      checks,
    )
    expect(seen).toHaveLength(2)
    for (const ctx of seen) {
      expect(ctx.doc).toBe(doc)
      expect(ctx.conventions.register).toEqual({ value: "polite", source: "argument" })
      expect(ctx.conventions.quotes).toEqual({ value: "corner", source: "setting" })
      expect(ctx.enabled("n_rule")).toBe(true)
      expect(ctx.enabled("n_off")).toBe(true)
      expect(ctx.enabled("e_rule")).toBe(false)
    }
  })

  test("refuses an unknown rule id before running any check", async () => {
    const { checks, seen } = recording()
    await expect(inspect(readDocument(CALL.text), { ...CALL, rules: ["nope"] }, {}, checks)).rejects.toThrow("nope")
    expect(seen).toEqual([])
  })

  test("reports what a check settled as the document's, unless a value was given", async () => {
    const check: CheckSpec = {
      name: "notation",
      rules: [rule("n_rule")],
      run: () => ({ findings: [], settled: { latin_spacing: "spaced", quotes: "double" } }),
    }
    const { conventions } = await inspect(readDocument(CALL.text), { ...CALL, quotes: "corner" }, {}, [check])
    expect(conventions.latin_spacing).toEqual({ value: "spaced", source: "document" })
    expect(conventions.quotes).toEqual({ value: "corner", source: "argument" })
    expect(conventions.register).toEqual({ value: null, source: "unset" })
  })

  test("returns the default number of findings when `limit` is left out", async () => {
    const rules = [rule("n_rule")]
    const many = Array.from({ length: DEFAULT_LIMIT + 5 }, () => found("n_rule", 0))
    const report = await inspect(readDocument(CALL.text), CALL, {}, [fakeCheck("notation", rules, many)])
    expect(report.findings).toHaveLength(DEFAULT_LIMIT)
    expect(report.cut).toEqual({ findings: 5 })
    expect(
      (await inspect(readDocument(CALL.text), { ...CALL, limit: 60 }, {}, [fakeCheck("notation", rules, many)])).cut,
    ).toBeUndefined()
  })
})
