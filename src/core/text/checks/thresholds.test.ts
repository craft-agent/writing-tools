import { describe, expect, test } from "bun:test"
import { GENRES } from "../rules"
import { KANJI_RUN, NO_CHAIN, SENTENCE_LENGTH, resolveThresholds } from "./thresholds"

describe("the genre's thresholds", () => {
  test("are 90 characters, 110 in essays, 6 kanji and 2 の for every genre", () => {
    expect(SENTENCE_LENGTH).toEqual({ general: 90, technical: 90, business: 90, essay: 110 })
    for (const genre of GENRES) {
      expect(KANJI_RUN[genre]).toBe(6)
      expect(NO_CHAIN[genre]).toBe(2)
    }
  })
})

describe("resolveThresholds", () => {
  test("gives the genre's values when no setting is given", () => {
    expect(resolveThresholds({}, "general")).toEqual({ sentence_length: 90, kanji_run: 6, no_chain: 2 })
    expect(resolveThresholds({}, "essay")).toEqual({ sentence_length: 110, kanji_run: 6, no_chain: 2 })
  })

  test("gives a setting's value in every genre, and only for that threshold", () => {
    for (const genre of GENRES) {
      expect(resolveThresholds({ sentence_length: 40, no_chain: 5 }, genre)).toEqual({
        sentence_length: 40,
        kanji_run: 6,
        no_chain: 5,
      })
    }
  })

  test("ignores a value that is not a number", () => {
    expect(resolveThresholds({ sentence_length: "40", kanji_run: ["7"], no_chain: Number.NaN }, "general")).toEqual({
      sentence_length: 90,
      kanji_run: 6,
      no_chain: 2,
    })
  })
})
