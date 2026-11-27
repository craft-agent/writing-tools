import { describe, expect, test } from "bun:test"
import { resolveConventions } from "./conventions"
import { readDocument } from "./document"
import { buildReport } from "./report"
import { fakeCheck, found, rule } from "./rules.testing"
import type { RawFinding } from "./rules"
import { UNTRUSTED_NOTE } from "./schemas"

const SPECS = [
  fakeCheck("notation", [
    rule("n_warn"),
    rule("n_critical", { severity: "critical", reference: "notation.md#critical-anchor" }),
    rule("n_info", { severity: "info" }),
  ]),
  fakeCheck("expression", [rule("e_warn", { check: "expression" })]),
]

function build(text: string, raws: RawFinding[], limit = 50) {
  return buildReport({
    doc: readDocument(text),
    checks: ["notation", "expression"],
    genre: "general",
    stance: undefined,
    conventions: resolveConventions({}, {}),
    notRun: [],
    found: raws,
    specs: SPECS,
    limit,
  })
}

describe("buildReport", () => {
  test("carries the version, method, checks, note, conventions and not_run as given", () => {
    const report = buildReport({
      doc: readDocument("x"),
      checks: ["expression"],
      genre: "technical",
      stance: "rule",
      conventions: resolveConventions({ register: "polite" }, {}),
      notRun: [{ check: "notation", reason: "morphology_unavailable", action: "engine_install" }],
      found: [],
      specs: SPECS,
      limit: 5,
    })
    expect(report).toMatchObject({
      report_version: 1,
      method: "inspect",
      checks: ["expression"],
      genre: "technical",
      stance: "rule",
      note: UNTRUSTED_NOTE,
    })
    expect(report.not_run).toEqual([{ check: "notation", reason: "morphology_unavailable", action: "engine_install" }])
    expect(report.conventions.register).toEqual({ value: "polite", source: "argument" })
    expect(report.findings).toEqual([])
    expect("cut" in report).toBe(false)
  })

  test("locates a finding in code points, with its excerpt, reason and the rule's reference", () => {
    const report = build("ab\n😀cd", [found("n_critical", 5, 7, { reason: "because" })])
    expect(report.findings).toEqual([
      {
        check: "notation",
        rule: "n_critical",
        severity: "critical",
        line: 2,
        column: 2,
        excerpt: "ab 😀cd",
        reason: "because",
        reference: "notation.md#critical-anchor",
      },
    ])
  })

  test("takes the check from the rule and lets a finding override the rule's severity", () => {
    const report = build("abc", [found("e_warn", 0, 1, { severity: "critical" })])
    expect(report.findings[0]).toMatchObject({ check: "expression", severity: "critical" })
    expect(report.counts.by_check.expression.critical).toBe(1)
    expect(report.counts.by_severity).toEqual({ critical: 1, warn: 0, info: 0 })
  })

  test("sorts by position, then by rule id", () => {
    const report = build("abcdefgh", [found("n_warn", 5), found("n_info", 2), found("n_warn", 0), found("e_warn", 5)])
    expect(report.findings.map((item) => [item.column, item.rule])).toEqual([
      [1, "n_warn"],
      [3, "n_info"],
      [6, "e_warn"],
      [6, "n_warn"],
    ])
  })

  test("counts by check and severity, with a zero for every check that found nothing", () => {
    const report = build("abcdefgh", [
      found("n_warn", 0),
      found("n_info", 1),
      found("n_info", 2),
      found("n_critical", 3),
    ])
    expect(report.counts).toEqual({
      total: 4,
      by_check: {
        notation: { critical: 1, warn: 1, info: 2 },
        expression: { critical: 0, warn: 0, info: 0 },
      },
      by_severity: { critical: 1, warn: 1, info: 2 },
    })
  })

  test("refuses a finding of a rule no check defines", () => {
    expect(() => build("abc", [found("nowhere", 0)])).toThrow("nowhere")
  })
})

describe("buildReport and the limit", () => {
  const TEXT = "x".repeat(40)
  const infos = Array.from({ length: 10 }, (_, index) => found("n_info", index))
  const criticals = [found("n_critical", 20), found("n_critical", 25)]

  test("keeps the most severe findings, so a limit never hides a critical behind infos", () => {
    const report = build(TEXT, [...infos, ...criticals, found("n_warn", 30)], 3)
    expect(report.findings.map((item) => [item.column, item.severity])).toEqual([
      [21, "critical"],
      [26, "critical"],
      [31, "warn"],
    ])
  })

  test("presents the kept findings in position order, and fills the rest of the limit by position", () => {
    const report = build(TEXT, [...infos, ...criticals], 4)
    expect(report.findings.map((item) => item.column)).toEqual([1, 2, 21, 26])
  })

  test("counts every finding and says how many were left out", () => {
    const report = build(TEXT, [...infos, ...criticals, found("n_warn", 30)], 3)
    expect(report.counts.total).toBe(13)
    expect(report.counts.by_severity).toEqual({ critical: 2, warn: 1, info: 10 })
    expect(report.cut).toEqual({ findings: 10 })
  })

  test("leaves `cut` out when the limit leaves nothing out", () => {
    expect("cut" in build(TEXT, [...infos], 10)).toBe(false)
    expect("cut" in build(TEXT, [...infos], 200)).toBe(false)
  })

  test("counts a very long list whole while returning only the limit", () => {
    const many = Array.from({ length: 20_000 }, (_, index) => found("n_info", index % 40))
    const report = build(TEXT, many, 50)
    expect(report.counts.total).toBe(20_000)
    expect(report.findings).toHaveLength(50)
    expect(report.cut).toEqual({ findings: 19_950 })
  })
})
