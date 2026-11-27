import { describe, expect, test } from "bun:test"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import type { CheckContext } from "../rules"
import { holdToMajority, judgeConvention, type Occurrence } from "./convention"

function at(value: string, start: number): Occurrence {
  return { value, start, end: start + 1 }
}

function context(args: Parameters<typeof resolveConventions>[0] = {}, options = {}): CheckContext {
  return { doc: readDocument(""), conventions: resolveConventions(args, options), enabled: () => true }
}

const SPACED = (start: number) => at("spaced", start)
const UNSPACED = (start: number) => at("unspaced", start)

describe("judgeConvention held to a value", () => {
  test("reports each occurrence of another value, naming the argument", () => {
    const { findings, settled } = judgeConvention(context({ latin_spacing: "spaced" }), "latin_spacing", [
      SPACED(0),
      UNSPACED(5),
      UNSPACED(9),
    ])
    expect(findings).toEqual([
      { rule: "latin_spacing", start: 5, end: 6, reason: "uses unspaced where the argument expects spaced" },
      { rule: "latin_spacing", start: 9, end: 10, reason: "uses unspaced where the argument expects spaced" },
    ])
    expect(settled).toBeUndefined()
  })

  test("names the setting when the value came from it, and ignores the text's own majority", () => {
    const { findings } = judgeConvention(context({}, { latin_spacing: "unspaced" }), "latin_spacing", [
      SPACED(0),
      SPACED(2),
      SPACED(4),
      UNSPACED(6),
    ])
    expect(findings.map((item) => item.reason)).toEqual([
      "uses spaced where the setting expects unspaced",
      "uses spaced where the setting expects unspaced",
      "uses spaced where the setting expects unspaced",
    ])
  })

  test("draws nothing from a text that uses only the expected value", () => {
    expect(judgeConvention(context({ latin_spacing: "spaced" }), "latin_spacing", [SPACED(0), SPACED(3)])).toEqual({
      findings: [],
    })
  })
})

describe("judgeConvention held to the document", () => {
  test("reports the less common value, naming the majority and the counts, and settles on the majority", () => {
    const { findings, settled } = judgeConvention(context(), "latin_spacing", [
      SPACED(0),
      UNSPACED(2),
      SPACED(4),
      SPACED(6),
    ])
    expect(findings).toEqual([
      {
        rule: "latin_spacing",
        start: 2,
        end: 3,
        reason: "unspaced here; the text mostly uses spaced (3 to 1)",
      },
    ])
    expect(settled).toEqual({ latin_spacing: "spaced" })
  })

  test("takes the value that occurs first as the majority on a tie", () => {
    const first = judgeConvention(context(), "latin_spacing", [UNSPACED(4), SPACED(8), UNSPACED(9), SPACED(1)])
    expect(first.settled).toEqual({ latin_spacing: "spaced" })
    expect(first.findings.map((item) => item.start)).toEqual([4, 9])
    expect(first.findings[0].reason).toBe("unspaced here; the text mostly uses spaced (2 to 2)")
  })

  test("settles on the one value a text uses and reports nothing", () => {
    expect(judgeConvention(context(), "latin_spacing", [UNSPACED(0), UNSPACED(5)])).toEqual({
      findings: [],
      settled: { latin_spacing: "unspaced" },
    })
  })

  test("settles nothing for a text that never uses the convention", () => {
    expect(judgeConvention(context(), "latin_spacing", [])).toEqual({ findings: [] })
  })

  test("holds a given `document` to the text even where a setting names a value", () => {
    const ctx = context({ latin_spacing: "document" }, { latin_spacing: "spaced" })
    expect(judgeConvention(ctx, "latin_spacing", [UNSPACED(0)]).settled).toEqual({ latin_spacing: "unspaced" })
  })
})

describe("holdToMajority", () => {
  test("counts three values and names the count of the value it reports", () => {
    const { findings, value } = holdToMajority("punctuation", [at("a", 0), at("a", 1), at("b", 2), at("c", 3)])
    expect(value).toBe("a")
    expect(findings.map((item) => item.reason)).toEqual([
      "b here; the text mostly uses a (2 to 1)",
      "c here; the text mostly uses a (2 to 1)",
    ])
  })

  test("writes the values as `show` says", () => {
    const { findings } = holdToMajority(
      "punctuation",
      [at("、", 0), at("、", 1), at("，", 2)],
      (value) => `\`${value}\``,
    )
    expect(findings[0].reason).toBe("`，` here; the text mostly uses `、` (2 to 1)")
  })
})
