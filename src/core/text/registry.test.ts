import { describe, expect, test } from "bun:test"
import { CHECK_SPECS } from "./registry"
import { CHECKS } from "./rules"

const RULES = CHECK_SPECS.flatMap((spec) => spec.rules)

describe("the rule registry", () => {
  test("holds one spec per check, in the order of the checks", () => {
    expect(CHECK_SPECS.map((spec) => spec.name)).toEqual([...CHECKS])
  })

  test("gives every rule a unique snake_case id", () => {
    const ids = RULES.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/)
  })

  test("files every rule under the check that holds it, with a reference to the skill's guide", () => {
    for (const spec of CHECK_SPECS) {
      for (const item of spec.rules) {
        expect(item.check).toBe(spec.name)
        expect(item.reference).toMatch(/^[a-z-]+\.md#[a-z0-9-]+$/)
      }
    }
  })
})
