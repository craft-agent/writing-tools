import { Buffer } from "node:buffer"
import { describe, expect, test } from "bun:test"
import { resolveConventions } from "./conventions"
import { readDocument } from "./document"
import { MAX_LIMIT, MAX_RESULT_BYTES } from "./limits"
import { buildReport } from "./report"
import { fakeCheck, found, rule } from "./rules.testing"
import type { RawFinding } from "./rules"

const SPECS = [
  fakeCheck("notation", [
    rule("n_warn"),
    rule("n_critical", { severity: "critical" }),
    rule("n_info", { severity: "info" }),
  ]),
  fakeCheck("expression", []),
]
const TEXT = "あ".repeat(500)
const LONG_REASON = "r".repeat(600)

function build(raws: RawFinding[], limit = MAX_LIMIT) {
  return buildReport({
    doc: readDocument(TEXT),
    checks: ["notation", "expression"],
    conventions: resolveConventions({}, {}),
    notRun: [],
    found: raws,
    specs: SPECS,
    limit,
  })
}

const bytesOf = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8")

/** 400 findings of one rule each, a critical on every twentieth offset and an info on the others. */
function crowd(reason: string): RawFinding[] {
  return Array.from({ length: 400 }, (_, index) =>
    found(index % 20 === 0 ? "n_critical" : "n_info", index, index + 1, { reason }),
  )
}

describe("buildReport and the byte budget", () => {
  test("keeps the whole result within the budget and says how many findings it cut", () => {
    const report = build(crowd(LONG_REASON))
    expect(bytesOf(report)).toBeLessThanOrEqual(MAX_RESULT_BYTES)
    expect(report.counts.total).toBe(400)
    expect(report.findings.length).toBeLessThan(MAX_LIMIT)
    expect(report.cut).toEqual({ findings: 400 - report.findings.length })
  })

  test("cuts the lowest severity and latest position first", () => {
    const report = build(crowd(LONG_REASON))
    const criticals = report.findings.filter((item) => item.severity === "critical")
    const infos = report.findings.filter((item) => item.severity === "info")
    expect(criticals).toHaveLength(20)
    const expectedInfos = Array.from({ length: 400 }, (_, index) => index + 1).filter(
      (column) => (column - 1) % 20 !== 0,
    )
    expect(infos.map((item) => item.column)).toEqual(expectedInfos.slice(0, infos.length))
    expect(infos.length).toBeLessThan(180)
    expect(report.findings.map((item) => item.column)).toEqual(
      [...report.findings.map((item) => item.column)].sort((a, b) => a - b),
    )
  })

  test("stops cutting as soon as the result fits", () => {
    const report = build(crowd(LONG_REASON))
    const smallest = Math.min(...report.findings.map(bytesOf))
    expect(bytesOf(report) + smallest).toBeGreaterThan(MAX_RESULT_BYTES)
  })

  test("counts the bytes of UTF-8, not the characters", () => {
    const report = build(crowd("日本語".repeat(100)))
    expect(JSON.stringify(report).length).toBeLessThan(bytesOf(report))
    expect(bytesOf(report)).toBeLessThanOrEqual(MAX_RESULT_BYTES)
    expect(report.cut?.findings).toBeGreaterThan(0)
  })

  test("adds the budget's cut to the limit's, so `cut` counts everything not returned", () => {
    const report = build(crowd(LONG_REASON), 100)
    expect(report.findings.length).toBeLessThan(100)
    expect(report.cut).toEqual({ findings: 400 - report.findings.length })
  })

  test("cuts only by the limit when the findings fit the budget", () => {
    const report = build(crowd("short"), 50)
    expect(report.findings).toHaveLength(50)
    expect(report.cut).toEqual({ findings: 350 })
    expect(build(crowd("short").slice(0, 10)).cut).toBeUndefined()
  })
})
