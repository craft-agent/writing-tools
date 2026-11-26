import { describe, expect, test } from "bun:test"
import type { EntryProfile } from "./profile"
import { parseSettings, parseTargetSettings, parseToolSettings, settingsFromOptions } from "./settings"
import { failure, profile } from "./settings.testing"

const valuesProfile: EntryProfile = {
  ...profile,
  options: {
    note_order: { type: "text", values: ["newest", "oldest"] },
    mode: { type: "text", values: ["document", "polite", "plain"] },
    single: { type: "text", values: ["only"] },
  },
}

const read = (argv: string[], env: Record<string, string | undefined> = {}) =>
  parseSettings(argv, env, valuesProfile).options

const readOption = (options: Record<string, unknown> | undefined, env: Record<string, string | undefined> = {}) =>
  settingsFromOptions(options, env, valuesProfile).options

describe("text options with fixed values", () => {
  test("accepts an allowed value from a flag, variable or plugin option", () => {
    expect(read(["--note-order", "newest", "--mode=plain"]).note_order).toBe("newest")
    expect(read(["--mode=plain"]).mode).toBe("plain")
    expect(read([], { DEMO_NOTE_ORDER: "oldest", DEMO_MODE: "document" })).toEqual({
      note_order: "oldest",
      mode: "document",
    })
    expect(readOption({ note_order: "oldest", mode: "polite" })).toEqual({
      note_order: "oldest",
      mode: "polite",
    })
    expect(parseToolSettings(["--note-order=newest"], {}, valuesProfile).options).toEqual({ note_order: "newest" })
    expect(parseTargetSettings(["--note-order", "oldest"], {}, valuesProfile).options).toEqual({
      note_order: "oldest",
    })
  })

  test("trims accepted values before they reach the tool", () => {
    expect(read(["--note-order", "  newest \t", "--mode= polite "])).toEqual({
      note_order: "newest",
      mode: "polite",
    })
    expect(read([], { DEMO_NOTE_ORDER: " oldest " })).toEqual({ note_order: "oldest" })
    expect(readOption({ note_order: "  oldest\n" })).toEqual({ note_order: "oldest" })
  })

  test("lets a flag or plugin option win even over an invalid environment value", () => {
    expect(read(["--note-order=newest"], { DEMO_NOTE_ORDER: "random" })).toEqual({ note_order: "newest" })
    expect(readOption({ note_order: "oldest" }, { DEMO_NOTE_ORDER: "random" })).toEqual({ note_order: "oldest" })
  })

  test("treats a blank value as unset and suppresses environment fallback", () => {
    expect(read([])).toEqual({})
    expect(read(["--note-order= ", "--mode="], { DEMO_NOTE_ORDER: "newest", DEMO_MODE: "bogus" })).toEqual({})
    expect(read([], { DEMO_NOTE_ORDER: "  ", DEMO_MODE: "" })).toEqual({})
    expect(readOption({ note_order: "  ", mode: "" }, { DEMO_NOTE_ORDER: "newest", DEMO_MODE: "bogus" })).toEqual({})
    expect(readOption({ note_order: undefined }, { DEMO_NOTE_ORDER: "oldest" })).toEqual({ note_order: "oldest" })
  })

  test("refuses any other value from a flag, variable or plugin option, listing the allowed values", () => {
    for (const [name, bad, expected] of [
      ["note_order", "latest", "one of newest, oldest"],
      ["mode", "formal", "one of document, polite, plain"],
      ["single", "other", "only"],
    ] as const) {
      const flag = `--${name.replace(/_/g, "-")}`
      const variable = `DEMO_${name.toUpperCase()}`
      expect(failure(() => read([flag, bad])).message).toBe(`${flag} must be ${expected}.`)
      expect(failure(() => read([`${flag}=${bad}`])).message).toBe(`${flag} must be ${expected}.`)
      expect(failure(() => read([], { [variable]: bad })).message).toBe(`${variable} must be ${expected}.`)
      expect(failure(() => readOption({ [name]: bad })).message).toBe(`Option "${name}" must be ${expected}.`)
      expect(failure(() => parseToolSettings([flag, bad], {}, valuesProfile)).message).toBe(
        `${flag} must be ${expected}.`,
      )
      expect(failure(() => parseTargetSettings([flag, bad], {}, valuesProfile)).message).toBe(
        `${flag} must be ${expected}.`,
      )
      expect(failure(() => readOption({}, { [variable]: bad })).message).toBe(`${variable} must be ${expected}.`)
    }
  })

  test("keeps the type error when a plugin option is not text", () => {
    for (const value of [1, true, null, ["newest"]]) {
      expect(failure(() => readOption({ note_order: value })).message).toBe('Option "note_order" must be text.')
    }
  })
})
