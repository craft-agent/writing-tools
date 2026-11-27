import { afterEach, describe, expect, test } from "bun:test"
import { fakeBridge, okReply, rawToken } from "../engine/analyze.testing"
import { removeTempDirs } from "../engine/engine.testing"
import { isAbortError } from "../errors"
import { readDocument } from "./document"
import { inspect } from "./inspect"
import { BRIDGE_FILE, engineOf, morphologyChecks, sentSegments } from "./morphology.testing"
import type { TextReadInput } from "./schemas"

afterEach(removeTempDirs)

/**
 * A soft line break, masked inline code and a non-BMP character in the first
 * paragraph; then a heading, a list item, a quotation and a table, which the
 * engine does not read; then a last paragraph.
 */
const TEXT = "😀を`code`見る\nよむ。\n\n# 見出し\n\n- 項目\n\n> 引用\n\n| 表 | 列 |\n|---|---|\n| あ | い |\n\nおわり。"

const CALL: TextReadInput = { method: "inspect", text: TEXT }

const PROSE_AND_LIST = ["prose", "list"]

/** The index in `doc.blocks` of each block of prose or a list item. */
function readBlocks(text: string): number[] {
  return readDocument(text).blocks.flatMap((block, index) => (PROSE_AND_LIST.includes(block.kind) ? [index] : []))
}

/** What the fake bridge answers for `TEXT`'s three segments, in code points of each. */
const TEXT_REPLY = okReply([
  {
    tokens: [
      rawToken("😀", 0, 1),
      rawToken("を", 1, 2),
      rawToken("見る", 8, 10, 1),
      rawToken("よむ", 11, 13, 1),
      rawToken("。", 13, 14),
    ],
  },
  { tokens: [rawToken("項目", 0, 2)] },
  { tokens: [rawToken("おわり", 0, 3), rawToken("。", 3, 4)] },
])

describe("inspect with a rule that needs tokens", () => {
  test("sends the blocks of prose and list items once, masked units and line breaks blanked", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    const { checks } = morphologyChecks()
    const report = await inspect(readDocument(TEXT), CALL, {}, checks, engineOf(bridge))
    expect(await sentSegments(bridge)).toEqual([`😀を${" ".repeat(6)}見る よむ。`, "項目", "おわり。"])
    expect(JSON.parse(await bridge.recorded("stdin")).mode).toBe("C")
    expect((await bridge.recorded("argv")).trim().split("\n")).toEqual(["-I", "-B", BRIDGE_FILE])
    expect(report.not_run).toEqual([])
  })

  test("gives the rule the tokens with their offsets in the text", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    const { checks, seen } = morphologyChecks()
    const doc = readDocument(TEXT)
    await inspect(doc, CALL, {}, checks, engineOf(bridge))

    const [ctx] = seen
    expect(seen).toHaveLength(1)
    expect([...ctx!.tokens.keys()]).toEqual(readBlocks(TEXT))
    const spans = [...ctx!.tokens.values()].flat().map((token) => [token.start, token.end] as const)
    expect(spans).toEqual([
      [0, 2],
      [2, 3],
      [9, 11],
      [12, 14],
      [14, 15],
      [26, 28],
      [67, 70],
      [70, 71],
    ])
    for (const token of [...ctx!.tokens.values()].flat()) {
      expect(doc.text.slice(token.start, token.end)).toBe(token.surface)
    }
  })

  test("leaves headings, table rows and quotations out of the tokens", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    const { checks, seen } = morphologyChecks()
    const doc = readDocument(TEXT)
    await inspect(doc, CALL, {}, checks, engineOf(bridge))
    const sent = new Set(seen[0]!.tokens.keys())
    const left = doc.blocks.filter((_, index) => !sent.has(index)).map((block) => block.kind)
    expect(left).toEqual(["heading", "quote", "table", "table"])
  })

  test("reports the other rules whatever the engine does", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    const { checks } = morphologyChecks()
    const report = await inspect(readDocument(TEXT), CALL, {}, checks, engineOf(bridge))
    expect(report.findings.map((item) => item.rule)).toEqual(["n_rule"])
    expect(report.checks).toEqual(["notation", "expression"])
  })

  test("sends no segment for a text without prose or list items, and starts nothing", async () => {
    const bridge = await fakeBridge()
    const { checks, seen } = morphologyChecks()
    const report = await inspect(readDocument("# 見出し\n\n> 引用"), CALL, {}, checks, engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(report.not_run).toEqual([])
    expect(seen[0]!.tokens.size).toBe(0)
  })
})

describe("inspect without a need for tokens", () => {
  test.each([
    ["no rule needs them", { morphology: false }, CALL],
    ["the rule is off by default", { defaultOn: false }, CALL],
    ["the rule is excluded", {}, { ...CALL, exclude_rules: ["m_rule"] }],
    ["the rule's check is not asked for", {}, { ...CALL, checks: ["notation"] as TextReadInput["checks"] }],
  ])("starts no engine when %s", async (_name, extra, call) => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    const { checks, seen } = morphologyChecks(extra)
    const report = await inspect(readDocument(TEXT), call, {}, checks, engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(report.not_run).toEqual([])
    for (const ctx of seen) expect(ctx.tokens.size).toBe(0)
  })

  test("starts the engine for a rule that is off by default once `rules` names it", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    const { checks, seen } = morphologyChecks({ defaultOn: false })
    await inspect(readDocument(TEXT), { ...CALL, rules: ["m_rule"] }, {}, checks, engineOf(bridge))
    expect(await bridge.started()).toBe(true)
    expect(seen[0]!.tokens.size).toBe(3)
  })

  test("does not reach for the engine when no morphology is asked for even without an engine context", async () => {
    const { checks } = morphologyChecks({ morphology: false })
    const report = await inspect(readDocument(TEXT), CALL, {}, checks)
    expect(report.not_run).toEqual([])
  })
})

describe("inspect and a cancellation", () => {
  test("rejects with the abort before the engine starts", async () => {
    const bridge = await fakeBridge()
    const controller = new AbortController()
    controller.abort()
    const { checks, seen } = morphologyChecks()
    const error = await inspect(
      readDocument(TEXT),
      CALL,
      {},
      checks,
      engineOf(bridge, { signal: controller.signal }),
    ).catch((e: unknown) => e)
    expect(isAbortError(error)).toBe(true)
    expect(await bridge.started()).toBe(false)
    expect(seen).toEqual([])
  })

  test("rejects when the abort comes during the engine call", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(TEXT_REPLY)
    await bridge.set("sleep", "2")
    const controller = new AbortController()
    const { checks } = morphologyChecks()
    const pending = inspect(
      readDocument(TEXT),
      CALL,
      {},
      checks,
      engineOf(bridge, { signal: controller.signal }),
    ).catch((e: unknown) => e)
    setTimeout(() => controller.abort(), 150)
    expect(isAbortError(await pending)).toBe(true)
  })
})
