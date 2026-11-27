import { describe, expect, test } from "bun:test"
import { CONVENTION_NAMES, CONVENTIONS } from "./conventions"
import { MAX_LIMIT } from "./limits"
import { GENRES, INSPECT_CHECKS, STANCES } from "./rules"
import { textReadInput } from "./schemas"

const BASE = { method: "inspect", text: "テスト" }

describe("the input schema", () => {
  test("takes the method and the text alone", () => {
    expect(textReadInput.strict().safeParse(BASE).success).toBe(true)
  })

  test("refuses a method the tool does not have, and a call without text", () => {
    expect(textReadInput.safeParse({ ...BASE, method: "diff" }).success).toBe(false)
    expect(textReadInput.safeParse({ method: "inspect" }).success).toBe(false)
  })

  test("refuses an argument it does not know", () => {
    expect(textReadInput.strict().safeParse({ ...BASE, tone: "essay" }).success).toBe(false)
  })

  test("takes the genres and the stances that exist, and refuses any other", () => {
    for (const genre of GENRES) expect(textReadInput.safeParse({ ...BASE, genre }).success).toBe(true)
    for (const stance of STANCES) expect(textReadInput.safeParse({ ...BASE, stance }).success).toBe(true)
    expect(textReadInput.safeParse({ ...BASE, genre: "poetry" }).success).toBe(false)
    expect(textReadInput.safeParse({ ...BASE, stance: "order" }).success).toBe(false)
  })

  test.each(CONVENTION_NAMES)("accepts every value of the convention %s and refuses any other", (name) => {
    for (const value of CONVENTIONS[name].values) {
      expect(textReadInput.safeParse({ ...BASE, [name]: value }).success).toBe(true)
    }
    expect(textReadInput.safeParse({ ...BASE, [name]: "nope" }).success).toBe(false)
  })

  test("takes the method `compare` with its original", () => {
    expect(textReadInput.strict().safeParse({ ...BASE, method: "compare", original: "元の文" }).success).toBe(true)
    expect(textReadInput.safeParse({ ...BASE, original: 1 }).success).toBe(false)
  })

  test("takes the checks of `inspect`, at least one, and not `revision`", () => {
    expect(textReadInput.safeParse({ ...BASE, checks: [...INSPECT_CHECKS] }).success).toBe(true)
    expect(textReadInput.safeParse({ ...BASE, checks: ["revision"] }).success).toBe(false)
    expect(textReadInput.safeParse({ ...BASE, checks: ["outline", "terms"] }).success).toBe(true)
    expect(textReadInput.safeParse({ ...BASE, checks: [] }).success).toBe(false)
    expect(textReadInput.safeParse({ ...BASE, checks: ["glossary"] }).success).toBe(false)
  })

  test("takes the rule lists as lists of text", () => {
    expect(textReadInput.safeParse({ ...BASE, rules: ["a"], exclude_rules: [] }).success).toBe(true)
    expect(textReadInput.safeParse({ ...BASE, rules: "a" }).success).toBe(false)
    expect(textReadInput.safeParse({ ...BASE, exclude_rules: [1] }).success).toBe(false)
  })

  test("bounds the limit to whole numbers from 1 to the most", () => {
    for (const limit of [1, 50, MAX_LIMIT]) {
      expect(textReadInput.safeParse({ ...BASE, limit }).success).toBe(true)
    }
    for (const limit of [0, -1, MAX_LIMIT + 1, 1.5, "10"]) {
      expect(textReadInput.safeParse({ ...BASE, limit }).success).toBe(false)
    }
  })

  test("describes every argument", () => {
    const shape = textReadInput.shape
    for (const [name, schema] of Object.entries(shape)) {
      expect(schema.description, name).toBeTruthy()
    }
  })
})
