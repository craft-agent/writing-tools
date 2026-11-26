import { afterEach, describe, expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { DICTIONARY_VERSION, PYTHON_VERSION, SUDACHIPY_VERSION, enginePaths } from "../core"
import { PINNED_LAYOUT, removeTempDirs, tempDir, writeVenv } from "../core/engine/engine.testing"
import { PROJECT } from "../project"
import { EXIT_FAILED, EXIT_OK } from "./cli"
import { STATE_DIR_FLAG } from "./command-args"
import { cli } from "./testing"

afterEach(removeTempDirs)

const INSTALL = `${PROJECT.cli} engine install`
const PINS = `this release pins SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core ${DICTIONARY_VERSION}, Python ${PYTHON_VERSION}`

describe("engine status", () => {
  test("reports ready with its venv without running an interpreter", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, PINNED_LAYOUT)
    const run = await cli(["engine", "status", STATE_DIR_FLAG, stateDir], "", { env: {} })
    expect(run.code).toBe(EXIT_OK)
    expect(run.stdout).toBe(
      `engine: ready (SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core ${DICTIONARY_VERSION}, Python ${PYTHON_VERSION})\nvenv: ${enginePaths(stateDir).venv}\n`,
    )
    expect(run.stderr).toBe("")
  })

  test.each([false, true])("reports missing, retaining the explicit state flag (equals: %j)", async (equals) => {
    const stateDir = await tempDir()
    const args = equals ? [`${STATE_DIR_FLAG}=${stateDir}`] : [STATE_DIR_FLAG, stateDir]
    const run = await cli(["engine", "status", ...args], "", { env: {} })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stdout).toBe(`engine: not installed\nrun: ${INSTALL} ${STATE_DIR_FLAG} ${stateDir}\n`)
    expect(run.stderr).toBe("")
    expect(await readdir(stateDir)).toEqual([])
  })

  test("does not repeat an environment or default directory in the suggested command", async () => {
    const home = await tempDir()
    for (const env of [{ HOME: home }, { HOME: home, DEMO_STATE_DIR: join(home, "state") }]) {
      const run = await cli(["engine", "status"], "", { env })
      expect(run.code).toBe(EXIT_FAILED)
      expect(run.stdout).toBe(`engine: not installed\nrun: ${INSTALL}\n`)
    }
  })

  test("the flag wins and paths with spaces or quotes are shell-quoted", async () => {
    const root = await tempDir()
    const stateDir = join(root, "it's here")
    const run = await cli(["engine", "status", STATE_DIR_FLAG, stateDir], "", {
      env: { DEMO_STATE_DIR: join(root, "other") },
    })
    expect(run.stdout).toBe(`engine: not installed\nrun: ${INSTALL} ${STATE_DIR_FLAG} '${root}/it'\\''s here'\n`)
  })

  test("reports a wrong dictionary against all three pins", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, { ...PINNED_LAYOUT, dictionary: "20250129" })
    const run = await cli(["engine", "status", STATE_DIR_FLAG, stateDir])
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stdout).toBe(
      `engine: needs reinstall (found SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core 20250129, Python ${PYTHON_VERSION}; ${PINS})\nrun: ${INSTALL} ${STATE_DIR_FLAG} ${stateDir}\n`,
    )
  })

  test("reports absent package versions as unknown", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, { pythonVersion: PYTHON_VERSION })
    const run = await cli(["engine", "status"], "", { env: { DEMO_STATE_DIR: stateDir } })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stdout).toBe(
      `engine: needs reinstall (found SudachiPy unknown, sudachidict_core unknown, Python ${PYTHON_VERSION}; ${PINS})\nrun: ${INSTALL}\n`,
    )
  })
})
