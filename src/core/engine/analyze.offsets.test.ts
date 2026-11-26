import { afterEach, describe, expect, test } from "bun:test"
import { MAX_SEGMENT_BYTES, analyze } from "./analyze"
import { NOUN, VERB, fakeBridge, okReply, rawToken, segmentsOf } from "./analyze.testing"
import { removeTempDirs } from "./engine.testing"
import type { Token } from "./tokens"

afterEach(removeTempDirs)

async function tokensOf(segment: string, raw: ReturnType<typeof rawToken>[]): Promise<readonly Token[]> {
  const bridge = await fakeBridge()
  await bridge.reply(okReply([{ tokens: raw }]))
  const [analysis] = segmentsOf(await analyze(bridge.options([segment])))
  if (!analysis || !("tokens" in analysis)) throw new Error("expected tokens")
  return analysis.tokens
}

describe("offsets", () => {
  test("become UTF-16 indexes after a character outside the BMP", async () => {
    const segment = "𠮷野家へ行った"
    const tokens = await tokensOf(segment, [
      rawToken("𠮷野家", 0, 3),
      rawToken("へ", 3, 4),
      rawToken("行っ", 4, 6, 1),
      rawToken("た", 6, 7),
    ])
    expect(tokens.map(({ surface, start, end }) => [surface, start, end])).toEqual([
      ["𠮷野家", 0, 4],
      ["へ", 4, 5],
      ["行っ", 5, 7],
      ["た", 7, 8],
    ])
    for (const { surface, start, end } of tokens) expect(segment.slice(start, end)).toBe(surface)
  })

  test("count an emoji sequence by code points", async () => {
    const segment = "😀と👨‍👩‍👧"
    const family = "👨‍👩‍👧"
    const tokens = await tokensOf(segment, [rawToken("😀", 0, 1), rawToken("と", 1, 2), rawToken(family, 2, 7)])
    expect(tokens.map(({ start, end }) => [start, end])).toEqual([
      [0, 2],
      [2, 3],
      [3, segment.length],
    ])
  })

  test("stay put on text without any such character, and cover an empty token list", async () => {
    expect((await tokensOf("猫が", [rawToken("猫", 0, 1), rawToken("が", 1, 2)])).map(({ end }) => end)).toEqual([1, 2])
    expect(await tokensOf("", [])).toEqual([])
  })

  test("accept an empty token at the end of the segment", async () => {
    const tokens = await tokensOf("😀", [rawToken("😀", 0, 1), rawToken("", 1, 1)])
    expect(tokens.map(({ start, end }) => [start, end])).toEqual([
      [0, 2],
      [2, 2],
    ])
  })
})

describe("part of speech", () => {
  test("is shared by the tokens that carry the same id, and frozen", async () => {
    const tokens = await tokensOf("猫犬行っ", [rawToken("猫", 0, 1), rawToken("犬", 1, 2), rawToken("行っ", 2, 4, 1)])
    expect(tokens[0]?.pos).toBe(tokens[1]?.pos)
    expect(tokens[0]?.pos).not.toBe(tokens[2]?.pos)
    expect(tokens[0]?.pos).toEqual(NOUN)
    expect(tokens[2]?.pos).toEqual(VERB)
    expect(Object.isFrozen(tokens[0]?.pos)).toBe(true)
  })
})

describe("segments that are not sent", () => {
  test("keep their place among the analyzed ones", async () => {
    const bridge = await fakeBridge()
    const tooLong = "a".repeat(MAX_SEGMENT_BYTES + 1)
    await bridge.reply(okReply([{ tokens: [rawToken("猫", 0, 1)] }, { tokens: [rawToken("犬", 0, 1)] }]))
    const segments = segmentsOf(await analyze(bridge.options(["猫", tooLong, "犬", tooLong])))
    expect(JSON.parse(await bridge.recorded("stdin"))).toEqual({ mode: "C", segments: ["猫", "犬"] })
    expect(segments).toEqual([
      { tokens: [expect.objectContaining({ surface: "猫" })] },
      { skipped: "segment_too_long" },
      { tokens: [expect.objectContaining({ surface: "犬" })] },
      { skipped: "segment_too_long" },
    ])
  })

  test("are measured in bytes of UTF-8, with the limit itself still sent", async () => {
    const bridge = await fakeBridge()
    const atLimit = "a".repeat(MAX_SEGMENT_BYTES - 1) + "b"
    const wide = "あ".repeat(Math.floor(MAX_SEGMENT_BYTES / 3) + 1)
    await bridge.reply(okReply([{ tokens: [] }]))
    const segments = segmentsOf(await analyze(bridge.options([wide, atLimit])))
    expect(JSON.parse(await bridge.recorded("stdin")).segments).toEqual([atLimit])
    expect(segments).toEqual([{ skipped: "segment_too_long" }, { tokens: [] }])
  })

  test("leave the engine alone when every segment is too long", async () => {
    const bridge = await fakeBridge()
    const tooLong = "a".repeat(MAX_SEGMENT_BYTES + 1)
    expect(segmentsOf(await analyze(bridge.options([tooLong, tooLong])))).toEqual([
      { skipped: "segment_too_long" },
      { skipped: "segment_too_long" },
    ])
    expect(await bridge.started()).toBe(false)
  })

  test("include a segment with a lone surrogate, which would fail the whole request", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }, { tokens: [] }]))
    const segments = segmentsOf(await analyze(bridge.options(["猫\ud800", "犬", "\udc00猫", "😀"])))
    expect(JSON.parse(await bridge.recorded("stdin")).segments).toEqual(["犬", "😀"])
    expect(segments.map((segment) => ("skipped" in segment ? segment.skipped : "tokens"))).toEqual([
      "morphology_failed",
      "tokens",
      "morphology_failed",
      "tokens",
    ])
  })
})
