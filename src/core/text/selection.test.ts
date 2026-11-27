import { describe, expect, test } from "bun:test"
import { isToolError } from "../errors"
import { fakeCheck, rule } from "./rules.testing"
import { selectRules } from "./selection"

const REGISTRY = [
  fakeCheck("notation", [rule("on_by_default"), rule("off_by_default", { defaultOn: false })]),
  fakeCheck("expression", [rule("other_off", { check: "expression", defaultOn: false })]),
]

function refusal(run: () => unknown): { code: unknown; message: string } {
  try {
    run()
  } catch (error) {
    if (isToolError(error)) return { code: error.code, message: error.message }
    throw error
  }
  throw new Error("expected a refusal")
}

describe("selectRules", () => {
  test("turns on the rules that are on by default, and no other", () => {
    const enabled = selectRules({}, {}, REGISTRY)
    expect(enabled("on_by_default")).toBe(true)
    expect(enabled("off_by_default")).toBe(false)
    expect(enabled("other_off")).toBe(false)
  })

  test("turns on a rule that is off by default when `rules` names it", () => {
    const enabled = selectRules({ rules: ["off_by_default"] }, {}, REGISTRY)
    expect(enabled("off_by_default")).toBe(true)
    expect(enabled("other_off")).toBe(false)
  })

  test("turns off any rule that `exclude_rules` names, and the exclusion wins", () => {
    const enabled = selectRules(
      { rules: ["off_by_default"], exclude_rules: ["off_by_default", "on_by_default"] },
      {},
      REGISTRY,
    )
    expect(enabled("on_by_default")).toBe(false)
    expect(enabled("off_by_default")).toBe(false)
  })

  test("reads both lists from the settings when the call gives none", () => {
    const enabled = selectRules({}, { rules: ["off_by_default"], exclude_rules: ["on_by_default"] }, REGISTRY)
    expect(enabled("off_by_default")).toBe(true)
    expect(enabled("on_by_default")).toBe(false)
  })

  test("lets an argument replace the setting of the same name, even with an empty list", () => {
    const options = { rules: ["off_by_default"], exclude_rules: ["on_by_default"] }
    const replaced = selectRules({ rules: ["other_off"], exclude_rules: [] }, options, REGISTRY)
    expect(replaced("off_by_default")).toBe(false)
    expect(replaced("other_off")).toBe(true)
    expect(replaced("on_by_default")).toBe(true)
    const emptied = selectRules({ rules: [] }, options, REGISTRY)
    expect(emptied("off_by_default")).toBe(false)
    expect(emptied("on_by_default")).toBe(false)
  })

  test("answers false for an id no check defines", () => {
    expect(selectRules({}, {}, REGISTRY)("nowhere")).toBe(false)
  })
})

describe("selectRules refusals", () => {
  test("refuse an unknown id from the argument, naming it and the argument", () => {
    const { code, message } = refusal(() => selectRules({ rules: ["on_by_default", "misspelt"] }, {}, REGISTRY))
    expect(code).toBe("invalid_argument")
    expect(message).toContain("misspelt")
    expect(message).toContain("`rules` argument")
    expect(message).not.toContain("on_by_default")
  })

  test("refuse an unknown id from the setting, naming it and the setting", () => {
    const { code, message } = refusal(() => selectRules({}, { exclude_rules: ["misspelt"] }, REGISTRY))
    expect(code).toBe("invalid_argument")
    expect(message).toContain("misspelt")
    expect(message).toContain("`exclude_rules` setting")
  })

  test("do not blame the setting for an id its argument replaced", () => {
    expect(() => selectRules({ rules: ["off_by_default"] }, { rules: ["misspelt"] }, REGISTRY)).not.toThrow()
  })

  test("refuse every id while the registry has no rules", () => {
    const empty = [fakeCheck("notation", []), fakeCheck("expression", [])]
    expect(refusal(() => selectRules({ rules: ["any_rule"] }, {}, empty)).message).toContain("any_rule")
    expect(refusal(() => selectRules({}, { rules: ["any_rule"] }, empty)).message).toContain("`rules` setting")
    expect(() => selectRules({}, {}, empty)).not.toThrow()
  })

  test("name a few unknown ids and count the rest", () => {
    const ids = Array.from({ length: 14 }, (_, index) => `missing_${index}`)
    const { message } = refusal(() => selectRules({ rules: ids }, {}, REGISTRY))
    expect(message).toContain("missing_0")
    expect(message).toContain("missing_9")
    expect(message).not.toContain("missing_10")
    expect(message).toContain("and 4 more")
  })

  test("name each unknown id once", () => {
    const { message } = refusal(() => selectRules({ rules: ["misspelt", "misspelt"] }, {}, REGISTRY))
    expect(message).toContain("rule id in")
    expect(message.match(/misspelt/g)).toHaveLength(1)
  })
})
