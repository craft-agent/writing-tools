import { afterEach, describe, expect, test } from "bun:test"
import { chmod, readFile, rename } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { MAX_SEGMENT_BYTES, analyze } from "./analyze"
import { fakeBridge, okReply, rawToken, segmentsOf } from "./analyze.testing"
import { removeTempDirs, tempDir } from "./engine.testing"
import { enginePaths } from "./state"

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url))

afterEach(removeTempDirs)

test("the segment limit matches the bridge's", async () => {
  const bridge = await readFile(join(REPO_ROOT, "engine/bridge.py"), "utf8")
  expect(bridge).toContain(`MAX_SEGMENT_BYTES = ${MAX_SEGMENT_BYTES}`)
})

describe("an engine that is not ready", () => {
  test("is unavailable without a venv", async () => {
    const stateDir = await tempDir()
    const result = await analyze({ stateDir, bridgeFile: "/bridge.py", segments: ["猫"], env: {} })
    expect(result).toEqual({
      available: false,
      reason: "morphology_unavailable",
      engine_status: "missing",
      action: "engine_install",
    })
  })

  test("is unavailable on pins that do not match, and starts nothing", async () => {
    const bridge = await fakeBridge()
    const site = join(enginePaths(bridge.stateDir).venv, "lib", "python3.12", "site-packages")
    await rename(join(site, "sudachipy-0.6.11.dist-info"), join(site, "sudachipy-0.0.1.dist-info"))
    const result = await analyze(bridge.options(["猫"]))
    expect(result).toEqual({
      available: false,
      reason: "morphology_unavailable",
      engine_status: "mismatch",
      action: "engine_install",
    })
    expect(await bridge.started()).toBe(false)
  })

  test("is unavailable, not a throw, for a state directory that is not absolute", async () => {
    const result = await analyze({ stateDir: "relative", bridgeFile: "/bridge.py", segments: ["猫"], env: {} })
    expect(result).toMatchObject({ available: false, reason: "morphology_unavailable", engine_status: "missing" })
  })

  test("is unavailable, not a throw, when the venv's packages cannot be listed", async () => {
    const bridge = await fakeBridge()
    const site = join(enginePaths(bridge.stateDir).venv, "lib", "python3.12", "site-packages")
    await chmod(site, 0o000)
    try {
      const result = await analyze(bridge.options(["猫"]))
      expect(result).toMatchObject({ available: false, reason: "morphology_unavailable", engine_status: "missing" })
      expect(await bridge.started()).toBe(false)
    } finally {
      await chmod(site, 0o755)
    }
  })
})

describe("a ready engine", () => {
  test("maps a good reply to tokens, in the order of the segments", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(
      okReply([{ tokens: [rawToken("猫", 0, 1)] }, { tokens: [rawToken("犬", 0, 1), rawToken("が", 1, 2, 1)] }]),
    )
    const segments = segmentsOf(await analyze(bridge.options(["猫", "犬が"])))
    expect(segments).toEqual([
      {
        tokens: [
          {
            surface: "猫",
            start: 0,
            end: 1,
            pos: expect.any(Array),
            normalized: "猫",
            dictionary: "猫",
            reading: "ヨミ",
          },
        ],
      },
      {
        tokens: [
          expect.objectContaining({ surface: "犬", start: 0, end: 1 }),
          expect.objectContaining({ surface: "が", start: 1, end: 2 }),
        ],
      },
    ])
  })

  test("sends mode C by default and the given mode when there is one", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await analyze(bridge.options(["猫"]))
    expect(JSON.parse(await bridge.recorded("stdin"))).toEqual({ mode: "C", segments: ["猫"] })
    await analyze(bridge.options(["猫"], { mode: "A" }))
    expect(JSON.parse(await bridge.recorded("stdin"))).toEqual({ mode: "A", segments: ["猫"] })
  })

  test("runs the venv's Python isolated on the bridge, in the engine directory", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await analyze(bridge.options(["猫"]))
    expect((await bridge.recorded("argv")).split("\n").filter(Boolean)).toEqual(["-I", "-B", bridge.bridgeFile])
    expect((await bridge.recorded("cwd")).trim()).toBe(bridge.engineDir)
  })

  test("passes no network variable and fixes the Python settings", async () => {
    const bridge = await fakeBridge()
    await bridge.reply(okReply([{ tokens: [] }]))
    await analyze(
      bridge.options(["猫"], {
        env: {
          PATH: "/usr/bin:/bin",
          HOME: "/home/user",
          HTTP_PROXY: "http://proxy",
          HTTPS_PROXY: "http://proxy",
          http_proxy: "http://proxy",
          SSL_CERT_FILE: "/cert.pem",
          STRAY: "leaks",
          PYTHONIOENCODING: "latin-1",
        },
      }),
    )
    const lines = (await bridge.recorded("env")).split("\n")
    expect(lines).toContain("HOME=/home/user")
    expect(lines).toContain("PYTHONIOENCODING=utf-8")
    expect(lines).toContain("PYTHONUTF8=1")
    expect(lines).toContain("PYTHONDONTWRITEBYTECODE=1")
    for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "SSL_CERT_FILE", "STRAY"]) {
      expect(lines.some((line) => line.startsWith(`${name}=`))).toBe(false)
    }
  })

  test("returns no segments for no segments, without starting the engine", async () => {
    const bridge = await fakeBridge()
    expect(await analyze(bridge.options([]))).toEqual({ available: true, segments: [] })
    expect(await bridge.started()).toBe(false)
  })
})
