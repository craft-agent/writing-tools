import { afterEach, describe, expect, test } from "bun:test"
import { fakeBridge } from "../engine/analyze.testing"
import { removeTempDirs, tempDir } from "../engine/engine.testing"
import { readDocument } from "./document"
import { inspect } from "./inspect"
import { engineAt, engineOf, morphologyChecks } from "./morphology.testing"
import { fakeCheck, found, rule } from "./rules.testing"
import type { CheckContext, CheckSpec, RuleSpec } from "./rules"
import type { TextReadInput } from "./schemas"

afterEach(removeTempDirs)

const CALL: TextReadInput = { method: "inspect", text: "猫が鳴く。" }

/** One `notation` check with a rule from each of `rules`, each finding something at 0; `seen` records its contexts. */
function checkOf(...rules: RuleSpec[]): { seen: CheckContext[]; checks: CheckSpec[] } {
  const seen: CheckContext[] = []
  const check: CheckSpec = {
    name: "notation",
    rules,
    run(ctx) {
      seen.push(ctx)
      return { findings: rules.filter((item) => ctx.enabled(item.id)).map((item) => found(item.id, 0)) }
    },
  }
  return { seen, checks: [check] }
}

async function ruleIds(call: TextReadInput, ...rules: RuleSpec[]): Promise<string[]> {
  const { checks } = checkOf(...rules)
  return (await inspect(readDocument(call.text), call, {}, checks)).findings.map((item) => item.rule)
}

describe("the genre", () => {
  test("is general in the context and the report when the call names none", async () => {
    const { checks, seen } = checkOf(rule("any"))
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks)
    expect(seen[0]!.genre).toBe("general")
    expect(report.genre).toBe("general")
  })

  test("is the one the call names, in the context and the report", async () => {
    const { checks, seen } = checkOf(rule("any"))
    const report = await inspect(readDocument(CALL.text), { ...CALL, genre: "essay" }, {}, checks)
    expect(seen[0]!.genre).toBe("essay")
    expect(report.genre).toBe("essay")
  })

  test("runs a rule that names no genres in every genre", async () => {
    for (const genre of ["general", "technical", "business", "essay"] as const) {
      expect(await ruleIds({ ...CALL, genre }, rule("any"))).toEqual(["any"])
    }
  })

  test("runs a rule only in the genres it names, the general one when the call names none", async () => {
    const prose = rule("prose_only", { genres: ["general", "essay"] })
    expect(await ruleIds(CALL, prose)).toEqual(["prose_only"])
    expect(await ruleIds({ ...CALL, genre: "essay" }, prose)).toEqual(["prose_only"])
    expect(await ruleIds({ ...CALL, genre: "technical" }, prose)).toEqual([])
    expect(await ruleIds({ ...CALL, genre: "business" }, prose)).toEqual([])
  })

  test("keeps a rule the genre turns off out of the context's enabled rules", async () => {
    const { checks, seen } = checkOf(rule("not_in_technical", { genres: ["general"] }))
    await inspect(readDocument(CALL.text), { ...CALL, genre: "technical" }, {}, checks)
    expect(seen[0]!.enabled("not_in_technical")).toBe(false)
  })

  test("turns a rule off even where `rules` names it", async () => {
    const off = rule("opt_in", { defaultOn: false, genres: ["essay"] })
    expect(await ruleIds({ ...CALL, rules: ["opt_in"] }, off)).toEqual([])
    expect(await ruleIds({ ...CALL, rules: ["opt_in"], genre: "essay" }, off)).toEqual(["opt_in"])
  })

  test("neither starts the engine for a rule that needs tokens nor lists it in `not_run`", async () => {
    const bridge = await fakeBridge()
    const { checks } = morphologyChecks({ genres: ["technical"] })
    const off = await inspect(readDocument(CALL.text), CALL, {}, checks, engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(off.not_run).toEqual([])
    const named = await inspect(
      readDocument(CALL.text),
      { ...CALL, genre: "technical" },
      {},
      checks,
      engineAt(await tempDir()),
    )
    expect(named.not_run.map((entry) => entry.rule)).toEqual(["m_rule"])
  })
})

describe("the stance", () => {
  test("is null in the report and undefined in the context when the call gives none", async () => {
    const { checks, seen } = checkOf(rule("any"))
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks)
    expect(seen[0]!.stance).toBeUndefined()
    expect(report.stance).toBeNull()
  })

  test("is the one the call gives, in the context and the report", async () => {
    const { checks, seen } = checkOf(rule("any"))
    const report = await inspect(readDocument(CALL.text), { ...CALL, stance: "rule" }, {}, checks)
    expect(seen[0]!.stance).toBe("rule")
    expect(report.stance).toBe("rule")
  })

  test("lets a rule that needs one run only when the call gives it", async () => {
    const ending = rule("ending", { needsStance: true })
    expect(await ruleIds(CALL, ending, rule("any"))).toEqual(["any"])
    for (const stance of ["advice", "rule", "explanation"] as const) {
      expect(await ruleIds({ ...CALL, stance }, ending, rule("any"))).toEqual(["any", "ending"])
    }
  })

  test("still honors `exclude_rules` and the genre for a rule that needs one", async () => {
    const ending = rule("ending", { needsStance: true, genres: ["general"] })
    expect(await ruleIds({ ...CALL, stance: "rule", exclude_rules: ["ending"] }, ending)).toEqual([])
    expect(await ruleIds({ ...CALL, stance: "rule", genre: "essay" }, ending)).toEqual([])
  })

  test("is never listed in `not_run` for lack of it, even for a rule that needs tokens", async () => {
    const bridge = await fakeBridge()
    const { checks } = morphologyChecks({ needsStance: true })
    const report = await inspect(readDocument(CALL.text), CALL, {}, checks, engineOf(bridge))
    expect(await bridge.started()).toBe(false)
    expect(report.not_run).toEqual([])
    const given = await inspect(
      readDocument(CALL.text),
      { ...CALL, stance: "advice" },
      {},
      checks,
      engineAt(await tempDir()),
    )
    expect(given.not_run.map((entry) => entry.rule)).toEqual(["m_rule"])
  })

  test("is echoed beside the checks that ran", async () => {
    const report = await inspect(
      readDocument(CALL.text),
      { ...CALL, stance: "explanation", genre: "business", checks: ["notation"] },
      {},
      [fakeCheck("notation", [rule("any")])],
    )
    expect(report).toMatchObject({ checks: ["notation"], genre: "business", stance: "explanation" })
  })
})
