import { afterEach, describe, expect, test } from "bun:test"
import { fakeBridge, okReply, rawToken } from "../engine/analyze.testing"
import { PINNED_LAYOUT, removeTempDirs, tempDir, writeVenv } from "../engine/engine.testing"
import { MAX_SEGMENT_BYTES } from "../engine/analyze"
import { readDocument } from "./document"
import { inspect } from "./inspect"
import { MAX_NOT_RUN_LINES } from "./limits"
import { engineAt, engineOf, morphologyChecks } from "./morphology.testing"
import { fakeCheck, rule } from "./rules.testing"
import type { CheckSpec } from "./rules"
import type { TextReadInput } from "./schemas"

afterEach(removeTempDirs)

const CALL: TextReadInput = { method: "inspect", text: "猫が鳴く。" }

const INSTALL = "demo-cli engine install"

/** One line of this many characters is more than the engine takes in a segment. */
const OVERSIZE = "あ".repeat(MAX_SEGMENT_BYTES / 3 + 1)

describe("when the engine cannot be used", () => {
  test("lists the rule as unavailable with the install command, while the other rules report", async () => {
    const { checks, seen } = morphologyChecks()
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks, engineAt(await tempDir()))
    expect(report.not_run).toEqual([
      { check: "expression", rule: "m_rule", reason: "morphology_unavailable", action: INSTALL },
    ])
    expect(report.findings.map((item) => item.rule)).toEqual(["n_rule"])
    expect(report.checks).toEqual(["notation", "expression"])
    expect(seen[0]!.tokens.size).toBe(0)
  })

  test("lists the rule as unavailable for an engine whose pins do not match", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, { ...PINNED_LAYOUT, sudachipy: "0.0.1" })
    const { checks } = morphologyChecks()
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks, engineAt(stateDir))
    expect(report.not_run).toEqual([
      { check: "expression", rule: "m_rule", reason: "morphology_unavailable", action: INSTALL },
    ])
  })

  test("lists one entry for each rule that needs tokens and is on, of any check", async () => {
    const reading = (id: string, extra = {}) => rule(id, { check: "expression", morphology: true, ...extra })
    const checks: CheckSpec[] = [
      fakeCheck("notation", [rule("n_morph", { morphology: true }), rule("n_plain")]),
      fakeCheck("expression", [reading("e_one"), reading("e_two"), reading("e_off", { defaultOn: false })]),
    ]
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks, engineAt(await tempDir()))
    expect(report.not_run.map((entry) => [entry.check, entry.rule])).toEqual([
      ["notation", "n_morph"],
      ["expression", "e_one"],
      ["expression", "e_two"],
    ])
  })

  test("names no command without a runtime to name it, and does not fail without a state or install directory", async () => {
    const { checks } = morphologyChecks()
    for (const missing of [{ runtime: undefined }, { stateDir: undefined }, { ownDir: undefined }]) {
      const report = await inspect(readDocument(CALL.text), CALL, {}, checks, engineAt(await tempDir(), missing))
      expect(report.not_run).toEqual([{ check: "expression", rule: "m_rule", reason: "morphology_unavailable" }])
    }
    const bare = await inspect(readDocument(CALL.text), CALL, {}, checks)
    expect(bare.not_run).toEqual([{ check: "expression", rule: "m_rule", reason: "morphology_unavailable" }])
  })

  test("lists the rule as failed, without a command, for an engine that fails", async () => {
    const bridge = await fakeBridge()
    await bridge.set("exit", "3")
    const { checks } = morphologyChecks()
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks, engineOf(bridge))
    expect(report.not_run).toEqual([{ check: "expression", rule: "m_rule", reason: "morphology_failed" }])
    expect(report.findings.map((item) => item.rule)).toEqual(["n_rule"])
    expect(JSON.stringify(report)).not.toContain("engine install")
  })
})

describe("when the engine skips blocks", () => {
  test("lists a block over the segment limit by its lines and tokenizes the others", async () => {
    const text = `${OVERSIZE}\n${OVERSIZE}\n${OVERSIZE}\n\n猫が鳴く。`
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [rawToken("猫", 0, 1)] }]))
    const { checks, seen } = morphologyChecks()
    const report = await inspect(readDocument(text), CALL, {}, checks, engineOf(bridge))
    expect(report.not_run).toEqual([
      { check: "expression", rule: "m_rule", reason: "segment_too_long", lines: [1, 2, 3] },
    ])
    expect([...seen[0]!.tokens.keys()]).toEqual([1])
    const lastBlockStart = text.indexOf("猫")
    expect(seen[0]!.tokens.get(1)).toEqual([
      expect.objectContaining({ surface: "猫", start: lastBlockStart, end: lastBlockStart + 1 }),
    ])
  })

  test("lists a block the bridge could not analyze as failed, apart from one that was too long", async () => {
    const text = `${OVERSIZE}\n\n犬\n\n猫\n\n鳥`
    const bridge = await fakeBridge()
    await bridge.reply(
      okReply([{ error: "tokenize_failed" }, { tokens: [rawToken("猫", 0, 1)] }, { error: "tokenize_failed" }]),
    )
    const { checks, seen } = morphologyChecks()
    const report = await inspect(readDocument(text), CALL, {}, checks, engineOf(bridge))
    expect(report.not_run).toEqual([
      { check: "expression", rule: "m_rule", reason: "segment_too_long", lines: [1] },
      { check: "expression", rule: "m_rule", reason: "morphology_failed", lines: [3, 7] },
    ])
    expect([...seen[0]!.tokens.keys()]).toEqual([2])
  })

  test("lists the skipped lines of every rule that needs tokens", async () => {
    const reading = (id: string) => rule(id, { check: "expression", morphology: true })
    const checks = [fakeCheck("expression", [reading("e_one"), reading("e_two")])]
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ error: "tokenize_failed" }]))
    const report = await inspect(readDocument("猫"), CALL, {}, checks, engineOf(bridge))
    expect(report.not_run.map((entry) => [entry.rule, entry.reason, entry.lines])).toEqual([
      ["e_one", "morphology_failed", [1]],
      ["e_two", "morphology_failed", [1]],
    ])
  })

  test("caps the lines of an entry at the first ones, in order", async () => {
    const paragraphs = Array.from({ length: MAX_NOT_RUN_LINES + 10 }, () => "猫")
    const bridge = await fakeBridge()
    await bridge.reply(okReply(paragraphs.map(() => ({ error: "tokenize_failed" }))))
    const { checks } = morphologyChecks()
    const report = await inspect(readDocument(paragraphs.join("\n\n")), CALL, {}, checks, engineOf(bridge))
    expect(report.not_run).toHaveLength(1)
    expect(report.not_run[0]!.lines).toEqual(Array.from({ length: MAX_NOT_RUN_LINES }, (_, index) => 1 + 2 * index))
  })

  test("lists nothing when every block was tokenized", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    const { checks } = morphologyChecks()
    expect((await inspect(readDocument("猫"), CALL, {}, checks, engineOf(bridge))).not_run).toEqual([])
  })
})
