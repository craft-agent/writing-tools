import { afterEach, describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { analyze } from "./analyze"
import { fakeBridge, okReply, rawToken, segmentsOf, type FakeBridge } from "./analyze.testing"
import { removeTempDirs } from "./engine.testing"
import { isAbortError } from "../errors"
import { enginePaths } from "./state"

afterEach(removeTempDirs)

const SEGMENT = "猫が𠮷野家へ"

/** The result of one call against a fake that replies as the test sets it up; it must be a failed call. */
async function failure(bridge: FakeBridge, segments: readonly string[] = [SEGMENT]) {
  const result = await analyze(bridge.options(segments))
  expect(result).toMatchObject({ available: false, reason: "morphology_failed" })
  expect(JSON.stringify(result)).not.toContain("猫")
  return result
}

describe("a segment the bridge could not analyze", () => {
  test("is skipped on its own, while the others keep their tokens", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(
      okReply([{ error: "tokenize_failed" }, { tokens: [rawToken("犬", 0, 1)] }, { error: "segment_too_long" }]),
    )
    expect(segmentsOf(await analyze(bridge.options(["猫", "犬", "鳥"])))).toEqual([
      { skipped: "morphology_failed" },
      { tokens: [expect.objectContaining({ surface: "犬" })] },
      { skipped: "segment_too_long" },
    ])
  })
})

describe("a reply that cannot be used", () => {
  test.each([
    ["not JSON", "oops"],
    ["empty", ""],
    ["two lines", `${JSON.stringify(okReply([{ tokens: [] }]))}\n${JSON.stringify(okReply([{ tokens: [] }]))}`],
    ["a JSON string", JSON.stringify("ok")],
    ["without pos", JSON.stringify({ ok: true, segments: [{ tokens: [] }] })],
    ["with a short pos entry", JSON.stringify({ ok: true, pos: [["名詞"]], segments: [{ tokens: [] }] })],
    ["with a segment that is neither tokens nor an error", JSON.stringify(okReply([{}]))],
    ["with an unknown segment error", JSON.stringify(okReply([{ error: "boom" }]))],
    ["with a token of the wrong shape", JSON.stringify(okReply([{ tokens: [["猫", 0, 1]] }]))],
    ["with a token whose pos id is not an integer", JSON.stringify(okReply([{ tokens: [rawToken("猫", 0, 1, 0.5)] }]))],
    [
      "with a token whose offsets are strings",
      JSON.stringify(okReply([{ tokens: [["猫", "0", "1", 0, "", "", ""]] }])),
    ],
  ])("%s is a failed call", async (_name, stdout) => {
    const bridge = await fakeBridge()
    await bridge.set("stdout", stdout)
    await failure(bridge, ["猫"])
  })

  test.each(["invalid_request", "engine_missing", "dictionary_failed", "something_else"])(
    "ok false with kind %s is a failed call",
    async (kind) => {
      const bridge = await fakeBridge()
      await bridge.reply({ ok: false, kind, error: "the dictionary could not be loaded" })
      await failure(bridge, ["猫"])
    },
  )

  test("with another number of segments than were sent is a failed call", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await failure(bridge, ["猫", "犬"])
    await bridge.reply(okReply([{ tokens: [] }, { tokens: [] }]))
    await failure(bridge, ["猫"])
  })

  test.each([
    ["a pos id past the table", rawToken("猫", 0, 1, 2)],
    ["a negative pos id", rawToken("猫", 0, 1, -1)],
    ["a fractional begin", rawToken("猫", 0.5, 1)],
    ["a negative begin", rawToken("猫", -1, 1)],
    ["an end past the segment", rawToken("猫が𠮷", 0, 4)],
    ["a begin after its end", rawToken("", 2, 1)],
    ["a surface other than the text at the offsets", rawToken("犬", 0, 1)],
  ])("with %s is a failed call", async (_name, token) => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [token] }]))
    await failure(bridge, ["猫が𠮷"])
  })

  test("with one bad token spoils the whole call, not that segment alone", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [rawToken("猫", 0, 1)] }, { tokens: [rawToken("鳥", 0, 1)] }]))
    await failure(bridge, ["猫", "犬"])
  })
})

describe("a call that does not finish", () => {
  test("exits non-zero is a failed call even with a good reply, and shows no stderr", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await bridge.set("stderr", `bridge crashed on ${SEGMENT}\n`)
    await bridge.set("exit", "1")
    const result = await failure(bridge)
    expect(result).toEqual({
      available: false,
      reason: "morphology_failed",
      detail: "the engine exited with code 1",
    })
  })

  test("outlives the time limit is a failed call", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await bridge.set("sleep", "2")
    const started = Date.now()
    const result = await analyze(bridge.options([SEGMENT], { timeoutMs: 150 }))
    expect(result).toMatchObject({ available: false, reason: "morphology_failed" })
    expect(Date.now() - started).toBeLessThan(1900)
  })

  test("is a failed call when the interpreter cannot be run", async () => {
    const bridge = await fakeBridge()
    await writeFile(enginePaths(bridge.stateDir).python, "#!/nonexistent/interpreter\n")
    await failure(bridge)
  })
})

describe("an abort", () => {
  test("before the call rejects with an AbortError and starts nothing", async () => {
    const bridge = await fakeBridge()
    const controller = new AbortController()
    controller.abort()
    const error = await analyze(bridge.options([SEGMENT], { signal: controller.signal })).catch((e: unknown) => e)
    expect(isAbortError(error)).toBe(true)
    expect(await bridge.started()).toBe(false)
  })

  test("during the call rejects with an AbortError", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await bridge.set("sleep", "2")
    const controller = new AbortController()
    const pending = analyze(bridge.options([SEGMENT], { signal: controller.signal })).catch((e: unknown) => e)
    setTimeout(() => controller.abort(), 150)
    expect(isAbortError(await pending)).toBe(true)
  })
})
