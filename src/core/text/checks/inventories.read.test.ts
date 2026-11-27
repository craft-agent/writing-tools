import { afterEach, describe, expect, test } from "bun:test"
import { fakeBridge } from "../../engine/analyze.testing"
import { removeTempDirs } from "../../engine/engine.testing"
import { isToolError } from "../../errors"
import { invoke } from "../../tool"
import { readDocument } from "../document"
import { inspect } from "../inspect"
import { engineOf } from "../morphology.testing"
import { writingTextRead } from "../read"

afterEach(removeTempDirs)

const CTX = { cwd: process.cwd() }

const DOCUMENT = [
  "# 概要",
  "",
  "APIの説明です。",
  "**重要**な点です。",
  "",
  "## 詳細",
  "",
  "- API（Application Programming Interface）",
  "- サーバとサーバーとGitHub",
].join("\n")

const read = (checks: ("outline" | "terms" | "notation")[], text = DOCUMENT) =>
  invoke(writingTextRead, { method: "inspect", text, checks }, CTX)

describe("writing_text_read with the outline and terms checks", () => {
  test("returns the inventories of a document, with no finding and nothing not run", async () => {
    const report = await read(["outline", "terms"])
    expect(report.checks).toEqual(["outline", "terms"])
    expect(report.findings).toEqual([])
    expect(report.not_run).toEqual([])
    expect(report.counts.total).toBe(0)
    expect(report.cut).toBeUndefined()
    expect(report.outline).toEqual({
      headings: [
        { level: 1, line: 1, column: 3, text: "概要", chars: 20 },
        { level: 2, line: 6, column: 4, text: "詳細", chars: 51 },
      ],
      measures: {
        lines: 6,
        chars: 75,
        bold_lines: 1,
        list_lines: 2,
        heading_lines: 2,
        bold_spans: 1,
        bold_share: 0.167,
        list_share: 0.333,
        heading_share: 0.333,
        bold_per_thousand: 13.33,
      },
    })
    expect(report.terms).toEqual([
      { term: "API", kind: "acronym", count: 2, line: 3, column: 1, glossed: true },
      {
        term: "サーバ",
        kind: "katakana",
        count: 2,
        forms: [
          { form: "サーバ", count: 1 },
          { form: "サーバー", count: 1 },
        ],
        line: 9,
        column: 3,
        glossed: false,
      },
      { term: "GitHub", kind: "latin", count: 1, line: 9, column: 12, glossed: false },
    ])
  })

  test("returns each inventory only when its check ran", async () => {
    const outline = await read(["outline"])
    expect(outline.outline?.headings).toHaveLength(2)
    expect("terms" in outline).toBe(false)
    const terms = await read(["terms"])
    expect(terms.terms).toHaveLength(3)
    expect("outline" in terms).toBe(false)
    const notation = await read(["notation"])
    expect("outline" in notation).toBe(false)
    expect("terms" in notation).toBe(false)
  })

  test("returns both when every check runs, beside the findings", async () => {
    const report = await invoke(writingTextRead, { method: "inspect", text: "データとベース。" }, CTX)
    expect(report.checks).toEqual(["notation", "expression", "readability", "outline", "terms"])
    expect(report.outline?.measures.lines).toBe(1)
    expect(report.terms?.map(({ term }) => term)).toEqual(["データ", "ベース"])
  })

  test("reads an empty text as empty inventories", async () => {
    const report = await read(["outline", "terms"], "")
    expect(report.outline?.headings).toEqual([])
    expect(report.terms).toEqual([])
  })

  test("have no rules to name: an id of either is an unknown rule", async () => {
    for (const id of ["outline", "terms"]) {
      const error = await invoke(writingTextRead, { method: "inspect", text: "a", rules: [id] }, CTX).catch(
        (thrown: unknown) => thrown,
      )
      expect(isToolError(error) && error.code).toBe("invalid_argument")
    }
  })
})

describe("inspect with only the inventories", () => {
  test("never starts the engine, and lists nothing as not run", async () => {
    const bridge = await fakeBridge()
    const call = { method: "inspect" as const, text: DOCUMENT, checks: ["outline", "terms"] as ("outline" | "terms")[] }
    const report = await inspect(readDocument(DOCUMENT), call, {}, undefined, engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(report.not_run).toEqual([])
    expect(report.outline).toBeDefined()
    expect(report.terms).toBeDefined()
  })

  test("lists nothing as not run without any engine either", async () => {
    const call = { method: "inspect" as const, text: DOCUMENT, checks: ["terms"] as "terms"[] }
    expect((await inspect(readDocument(DOCUMENT), call, {})).not_run).toEqual([])
  })
})
