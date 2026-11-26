import { describe, expect, test } from "bun:test"
import { CONVENTION_NAMES, CONVENTIONS, resolveConventions, type ResolvedConvention } from "./conventions"

const UNSET: ResolvedConvention = { value: null, source: "unset" }

describe("the conventions table", () => {
  test("holds the ten conventions, each with `document` first", () => {
    expect(CONVENTION_NAMES).toHaveLength(10)
    for (const name of CONVENTION_NAMES) {
      expect(CONVENTIONS[name].values[0]).toBe("document")
      expect(new Set(CONVENTIONS[name].values).size).toBe(CONVENTIONS[name].values.length)
    }
  })
})

describe("resolveConventions", () => {
  test("holds nothing to anything when no argument or setting says so", () => {
    const resolved = resolveConventions({}, {})
    expect(Object.keys(resolved)).toEqual([...CONVENTION_NAMES])
    for (const name of CONVENTION_NAMES) expect(resolved[name]).toEqual(UNSET)
  })

  test("reads a setting, naming it as the source", () => {
    expect(resolveConventions({}, { register: "polite" }).register).toEqual({ value: "polite", source: "setting" })
  })

  test("lets an argument win over the setting", () => {
    const resolved = resolveConventions({ register: "plain" }, { register: "polite", quotes: "corner" })
    expect(resolved.register).toEqual({ value: "plain", source: "argument" })
    expect(resolved.quotes).toEqual({ value: "corner", source: "setting" })
  })

  test("takes `document` from either as holding the text to itself, which is unset for now", () => {
    expect(resolveConventions({ register: "document" }, {}).register).toEqual(UNSET)
    expect(resolveConventions({}, { register: "document" }).register).toEqual(UNSET)
  })

  test("lets a given `document` win over a setting", () => {
    expect(resolveConventions({ register: "document" }, { register: "polite" }).register).toEqual(UNSET)
  })

  test("ignores a setting that is not text", () => {
    expect(resolveConventions({}, { register: true, quotes: ["corner"] }).register).toEqual(UNSET)
    expect(resolveConventions({}, { quotes: ["corner"] }).quotes).toEqual(UNSET)
  })

  test("gives every call its own objects", () => {
    const first = resolveConventions({}, {})
    first.register.value = "polite"
    expect(resolveConventions({}, {}).register).toEqual(UNSET)
  })
})
