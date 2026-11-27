import { afterEach, describe, expect, test } from "bun:test"
import { MAX_SEGMENT_BYTES } from "../engine/analyze"
import { fakeBridge, okReply, rawToken } from "../engine/analyze.testing"
import { removeTempDirs, tempDir } from "../engine/engine.testing"
import { invoke, type ToolContext } from "../tool"
import { WORDS_UNAVAILABLE } from "./checks/revision.testing"
import { engineAt, engineOf, sentSegments } from "./morphology.testing"
import { writingTextRead } from "./read"
import type { TextReadInput, TextReadOutput } from "./schemas"

afterEach(removeTempDirs)

/** Part of speech ids of the fake reply: nouns and verbs, which are content words. */
const NOUN = 0
const VERB = 1

const INSTALL = "demo-cli engine install"

/** One line of this many characters is more than the engine takes in a segment. */
const OVERSIZE = "あ".repeat(MAX_SEGMENT_BYTES / 3 + 1)

/** The findings of the number rules on `REVISION` and `ORIGINAL`, in position order. */
const NUMBER_RULES = ["number_lost", "number_added"]

const REVISION = "猫が鳴く。\n\n価格は20円です。"
const ORIGINAL = "犬が鳴く。\n\n価格は30円です。"

/** What the fake engine says of the revision's two paragraphs, then of the original's: 猫 and 犬 are the only words that differ. */
const REPLY = okReply([
  { tokens: [rawToken("猫", 0, 1, NOUN), rawToken("鳴く", 2, 4, VERB)] },
  { tokens: [rawToken("価格", 0, 2, NOUN)] },
  { tokens: [rawToken("犬", 0, 1, NOUN), rawToken("鳴く", 2, 4, VERB)] },
  { tokens: [rawToken("価格", 0, 2, NOUN)] },
])

function compareCall(extra: Partial<TextReadInput> = {}, original = ORIGINAL, text = REVISION): TextReadInput {
  return { method: "compare", text, original, ...extra }
}

/** The call as `invoke` runs it, with the engine of `context`. */
function read(args: TextReadInput, context: Partial<ToolContext> = {}): Promise<TextReadOutput> {
  return invoke(writingTextRead, args, { cwd: process.cwd(), ...context })
}

describe("compare with the engine", () => {
  test("reads both texts in one engine call, the revision's paragraphs first", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(REPLY)
    const report = await read(compareCall(), engineOf(bridge))
    expect(await bridge.runs()).toBe(1)
    expect(await sentSegments(bridge)).toEqual(["猫が鳴く。", "価格は20円です。", "犬が鳴く。", "価格は30円です。"])
    expect(report.not_run).toEqual([])
    expect(report.findings.map(({ rule, reason }) => [rule, reason])).toEqual([
      ["content_word_added", '"猫" is in the revision but not in the original'],
      ["content_word_lost", '"犬" is in the original but not in the revision'],
      ["number_lost", '"30" is in the original but not in the revision'],
      ["number_added", '"20" is in the revision but not in the original'],
    ])
  })

  test("places a lost word where it would have stood, with its place in the original", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(REPLY)
    const report = await read(compareCall(), engineOf(bridge))
    const lost = report.findings.find(({ rule }) => rule === "content_word_lost")
    expect(lost).toMatchObject({
      line: 1,
      column: 1,
      original_line: 1,
      original_column: 1,
      excerpt: "犬が鳴く。  価格は30円です。",
    })
  })

  test("starts nothing when both content word rules are excluded, and the other rules report", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(REPLY)
    const exclude_rules = ["content_word_lost", "content_word_added"]
    const report = await read(compareCall({ exclude_rules }), engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(report.not_run).toEqual([])
    expect(report.findings.map(({ rule }) => rule)).toEqual(NUMBER_RULES)
  })

  test("starts the engine for one rule alone and lists only that rule", async () => {
    const bridge = await fakeBridge()
    await bridge.set("exit", "3")
    const report = await read(compareCall({ exclude_rules: ["content_word_added"] }), engineOf(bridge))
    expect(await bridge.runs()).toBe(1)
    expect(report.not_run).toEqual([{ check: "revision", rule: "content_word_lost", reason: "morphology_failed" }])
  })

  test("sends only the original when the revision has no paragraph to read", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [rawToken("犬", 0, 1, NOUN)] }]))
    const report = await read(compareCall({}, "犬", "# 見出し"), engineOf(bridge))
    expect(await sentSegments(bridge)).toEqual(["犬"])
    expect(report.findings.map(({ rule }) => rule)).toEqual(["content_word_lost"])
  })

  test("lists the paragraphs the engine skipped, the original's with text: original, and reports no word", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [rawToken("猫", 0, 1, NOUN)] }, { tokens: [rawToken("犬", 0, 1, NOUN)] }]))
    const original = `${OVERSIZE}\n\n犬`
    const report = await read(compareCall({}, original, "猫"), engineOf(bridge))
    expect(report.findings).toEqual([])
    expect(report.not_run).toEqual(
      ["content_word_lost", "content_word_added"].map((rule) => ({
        check: "revision",
        rule,
        reason: "segment_too_long",
        lines: [1],
        text: "original",
      })),
    )
  })

  test("lists the revision's skipped lines without text, and the original's with it", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply(Array.from({ length: 3 }, () => ({ error: "tokenize_failed" }))))
    const report = await read(
      compareCall({ exclude_rules: ["content_word_added"] }, "犬\n\n猫", "鳥"),
      engineOf(bridge),
    )
    expect(report.not_run).toEqual([
      { check: "revision", rule: "content_word_lost", reason: "morphology_failed", lines: [1] },
      { check: "revision", rule: "content_word_lost", reason: "morphology_failed", lines: [1, 3], text: "original" },
    ])
  })
})

describe("compare without the engine", () => {
  test("lists both content word rules with the install command, while the other rules report", async () => {
    const report = await read(compareCall(), engineAt(await tempDir()))
    const action = INSTALL
    expect(report.not_run).toEqual(WORDS_UNAVAILABLE.map((entry) => ({ ...entry, action })))
    expect(report.findings.map(({ rule }) => rule)).toEqual(NUMBER_RULES)
  })

  test("lists them without a command when no engine is configured", async () => {
    expect((await read(compareCall())).not_run).toEqual(WORDS_UNAVAILABLE)
  })

  test("lists them as failed, without a command, when the engine fails", async () => {
    const bridge = await fakeBridge()
    await bridge.set("exit", "3")
    const report = await read(compareCall(), engineOf(bridge))
    expect(report.not_run.map(({ reason }) => reason)).toEqual(["morphology_failed", "morphology_failed"])
    expect(JSON.stringify(report)).not.toContain("engine install")
    expect(report.findings.map(({ rule }) => rule)).toEqual(NUMBER_RULES)
  })

  test("starts nothing when neither text has a paragraph to read", async () => {
    const bridge = await fakeBridge()
    const report = await read(compareCall({}, "# 犬", "# 猫"), engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(report.not_run).toEqual([])
  })
})
