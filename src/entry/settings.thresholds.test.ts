import { describe, expect, test } from "bun:test"
import { PROJECT } from "../project"
import type { EntryProfile } from "./profile"
import { parseSettings, settingsFromOptions } from "./settings"
import { failure, profile } from "./settings.testing"

const projectProfile: EntryProfile = { ...profile, envPrefix: PROJECT.envPrefix, options: PROJECT.options }

const read = (argv: string[], env: Record<string, string | undefined> = {}) =>
  parseSettings(argv, env, projectProfile).options

const THRESHOLDS = [
  ["sentence_length", "--sentence-length", "WRITING_TOOLS_SENTENCE_LENGTH", 20, 400],
  ["kanji_run", "--kanji-run", "WRITING_TOOLS_KANJI_RUN", 4, 20],
  ["no_chain", "--no-chain", "WRITING_TOOLS_NO_CHAIN", 2, 10],
] as const

describe.each(THRESHOLDS)("the %s threshold", (name, flag, variable, min, max) => {
  const expected = `a whole number from ${min} to ${max}`

  test("takes a whole number within its bounds, from a flag, a variable or a plugin option", () => {
    for (const value of [min, max]) {
      expect(read([`${flag}=${value}`])).toEqual({ [name]: value })
      expect(read([], { [variable]: String(value) })).toEqual({ [name]: value })
      expect(settingsFromOptions({ [name]: value }, {}, projectProfile).options).toEqual({ [name]: value })
    }
  })

  test("refuses a number outside its bounds or a fraction as invalid_argument, naming the setting", () => {
    for (const value of [min - 1, max + 1, min + 0.5]) {
      expect(failure(() => read([`${flag}=${value}`])).message).toBe(`${flag} must be ${expected}.`)
      expect(failure(() => read([], { [variable]: String(value) })).message).toBe(`${variable} must be ${expected}.`)
      expect(failure(() => settingsFromOptions({ [name]: value }, {}, projectProfile)).message).toBe(
        `Option "${name}" must be ${expected}.`,
      )
    }
  })

  test("is left unset when no source gives it", () => {
    expect(read([])).toEqual({})
  })
})
