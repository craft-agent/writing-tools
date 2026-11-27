import { Buffer } from "node:buffer"
import { describe, expect, test } from "bun:test"
import { resolveConventions } from "./conventions"
import { readDocument } from "./document"
import { MAX_OUTLINE_ENTRIES, MAX_RESULT_BYTES, MAX_TERMS } from "./limits"
import { buildReport, type ReportInput } from "./report"
import { fakeCheck, found, rule } from "./rules.testing"
import type { Outline, Term } from "./schemas"

const SPECS = [fakeCheck("notation", [rule("n_info", { severity: "info" })])]

const MEASURES: Outline["measures"] = {
  lines: 1,
  chars: 3,
  bold_lines: 0,
  list_lines: 0,
  heading_lines: 0,
  bold_spans: 0,
  bold_share: 0,
  list_share: 0,
  heading_share: 0,
  bold_per_thousand: 0,
}

function build(extra: Partial<ReportInput> = {}) {
  return buildReport({
    doc: readDocument("あ".repeat(50)),
    checks: ["notation"],
    genre: "general",
    stance: undefined,
    conventions: resolveConventions({}, {}),
    notRun: [],
    found: [],
    specs: SPECS,
    limit: 200,
    ...extra,
  })
}

const bytesOf = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8")

/** `count` headings, the n-th named `h<n>` and padded with `pad` characters. */
function headings(count: number, pad = 0): Outline {
  return {
    headings: Array.from({ length: count }, (_, index) => ({
      level: 1,
      line: index + 1,
      column: 1,
      text: `h${index}${"x".repeat(pad)}`,
      chars: 1,
    })),
    measures: MEASURES,
  }
}

/** `count` terms in order of first use, the n-th named `t<n>`, padded with `pad` characters and used `counts(n)` times. */
function termList(count: number, counts: (index: number) => number, pad = 0): Term[] {
  return Array.from({ length: count }, (_, index) => ({
    term: `t${index}${"y".repeat(pad)}`,
    kind: "latin",
    count: counts(index),
    line: 1,
    column: 1,
    glossed: false,
  }))
}

/** Findings of one rule, each with a reason of `size` characters. */
function crowd(count: number, size: number) {
  return Array.from({ length: count }, (_, index) =>
    found("n_info", index % 50, index % 50, { reason: "r".repeat(size) }),
  )
}

describe("the inventories in the report", () => {
  test("are present exactly when their check ran", () => {
    const neither = build()
    expect("outline" in neither).toBe(false)
    expect("terms" in neither).toBe(false)
    const outlineOnly = build({ outline: headings(2) })
    expect(outlineOnly.outline?.headings).toHaveLength(2)
    expect("terms" in outlineOnly).toBe(false)
    const termsOnly = build({ terms: [] })
    expect(termsOnly.terms).toEqual([])
    expect("outline" in termsOnly).toBe(false)
    expect("cut" in termsOnly).toBe(false)
  })

  test("carry the measures and every heading and term as given while within the caps", () => {
    const outline = headings(MAX_OUTLINE_ENTRIES)
    const terms = termList(MAX_TERMS, () => 1)
    const report = build({ outline, terms })
    expect(report.outline).toEqual(outline)
    expect(report.terms).toEqual(terms)
    expect("cut" in report).toBe(false)
  })

  test("list the first headings up to the cap and count the rest in `cut.outline`", () => {
    const report = build({ outline: headings(MAX_OUTLINE_ENTRIES + 50) })
    expect(report.outline?.headings.map(({ text }) => text)).toEqual(
      Array.from({ length: MAX_OUTLINE_ENTRIES }, (_, index) => `h${index}`),
    )
    expect(report.outline?.measures).toEqual(MEASURES)
    expect(report.cut).toEqual({ outline: 50 })
  })

  test("list the most used terms up to the cap, the first used winning a tie, in order of first use", () => {
    const report = build({ terms: termList(150, (index) => (index % 3 === 0 ? 4 : 2)) })
    const expected = Array.from({ length: 150 }, (_, index) => index).filter((index) => index % 3 === 0 || index <= 75)
    expect(report.terms?.map(({ term }) => term)).toEqual(expected.map((index) => `t${index}`))
    expect(report.terms).toHaveLength(MAX_TERMS)
    expect(report.cut).toEqual({ terms: 50 })
  })

  test("name every list that lost entries in `cut`, and only those", () => {
    const report = build({
      found: crowd(60, 5),
      limit: 50,
      outline: headings(MAX_OUTLINE_ENTRIES + 1),
      terms: termList(MAX_TERMS + 2, () => 1),
    })
    expect(report.cut).toEqual({ findings: 10, outline: 1, terms: 2 })
    expect(build({ found: crowd(60, 5), limit: 50, outline: headings(1) }).cut).toEqual({ findings: 10 })
  })
})

describe("the inventories and the byte budget", () => {
  test("cut the findings before any heading or term", () => {
    const report = build({ found: crowd(200, 600), outline: headings(100), terms: termList(50, () => 1) })
    expect(bytesOf(report)).toBeLessThanOrEqual(MAX_RESULT_BYTES)
    expect(report.findings.length).toBeGreaterThan(0)
    expect(report.cut).toEqual({ findings: 200 - report.findings.length })
    expect(report.outline?.headings).toHaveLength(100)
    expect(report.terms).toHaveLength(50)
  })

  test("then cut headings from the end, once no finding is left", () => {
    const report = build({ found: crowd(3, 10), outline: headings(250, 600), terms: termList(20, () => 1) })
    const kept = report.outline?.headings ?? []
    expect(bytesOf(report)).toBeLessThanOrEqual(MAX_RESULT_BYTES)
    expect(report.findings).toEqual([])
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(MAX_OUTLINE_ENTRIES)
    expect(kept.map(({ line }) => line)).toEqual(Array.from({ length: kept.length }, (_, index) => index + 1))
    expect(report.terms).toHaveLength(20)
    expect(report.cut).toEqual({ findings: 3, outline: 250 - kept.length })
    expect(bytesOf(report) + bytesOf(headings(1, 600).headings[0])).toBeGreaterThan(MAX_RESULT_BYTES)
  })

  test("then cut the least used terms, the latest first used among equals, once no heading is left", () => {
    const counts = (index: number) => (index % 10) + 1
    const terms = termList(MAX_TERMS, counts, 900)
    const report = build({ found: crowd(3, 10), outline: headings(200, 100), terms })
    const kept = report.terms ?? []
    const droppedFirst = [...terms]
      .map((term, index) => ({ term, index }))
      .sort((a, b) => a.term.count - b.term.count || b.index - a.index)
      .slice(0, terms.length - kept.length)
      .map(({ term }) => term.term)
    expect(bytesOf(report)).toBeLessThanOrEqual(MAX_RESULT_BYTES)
    expect(report.findings).toEqual([])
    expect(report.outline?.headings).toEqual([])
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(terms.length)
    expect(kept.map(({ term }) => term)).toEqual(
      terms.map(({ term }) => term).filter((term) => !droppedFirst.includes(term)),
    )
    expect(report.cut).toEqual({ findings: 3, outline: 200, terms: terms.length - kept.length })
  })

  test("leave the outline and the terms whole when the findings alone are cut to fit", () => {
    const outline = headings(5)
    const terms = termList(5, () => 1)
    const report = build({ found: crowd(200, 600), outline, terms })
    expect(report.outline).toEqual(outline)
    expect(report.terms).toEqual(terms)
  })
})
