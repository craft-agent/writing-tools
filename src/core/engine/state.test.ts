import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, readFile, readdir, rename, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { DICTIONARY_VERSION, PYTHON_VERSION, SUDACHIPY_VERSION, enginePaths, readEngineState } from "./state"
import { PINNED_LAYOUT, removeTempDirs, tempDir, writeVenv, type VenvLayout } from "./engine.testing"

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url))

afterEach(removeTempDirs)

test("the requirements and lock match both package pins and carry hashes", async () => {
  const requirements = await readFile(join(REPO_ROOT, "engine/requirements.in"), "utf8")
  const lock = await readFile(join(REPO_ROOT, "engine/requirements.lock"), "utf8")
  for (const [input, locked, version] of [
    ["SudachiPy", "sudachipy", SUDACHIPY_VERSION],
    ["sudachidict_core", "sudachidict-core", DICTIONARY_VERSION],
  ]) {
    expect(requirements).toContain(`${input}==${version}`)
    expect(lock).toContain(`${locked}==${version} \\\n    --hash=sha256:`)
  }
})

describe("enginePaths", () => {
  test("puts the venv under the absolute state root", () => {
    expect(enginePaths("/state")).toEqual({
      dir: "/state/engine",
      venv: "/state/engine/venv",
      python: "/state/engine/venv/bin/python",
    })
    expect(() => enginePaths("relative")).toThrow("State directory must be absolute")
  })
})

describe("readEngineState", () => {
  test("is missing and creates nothing without a venv", async () => {
    const stateDir = await tempDir()
    expect(await readEngineState(stateDir)).toEqual({
      status: "missing",
      venv: enginePaths(stateDir).venv,
      python_version: null,
      sudachipy_version: null,
      dictionary_version: null,
    })
    expect(await readdir(stateDir)).toEqual([])
  })

  test("is missing without a usable interpreter or config", async () => {
    const noPython = await tempDir()
    await writeVenv(noPython, { ...PINNED_LAYOUT, python: false })
    expect((await readEngineState(noPython)).status).toBe("missing")
    await mkdir(enginePaths(noPython).python)
    expect((await readEngineState(noPython)).status).toBe("missing")
    const noConfig = await tempDir()
    await writeVenv(noConfig, { sudachipy: SUDACHIPY_VERSION })
    expect((await readEngineState(noConfig)).status).toBe("missing")
    const notExecutable = await tempDir()
    await writeVenv(notExecutable, PINNED_LAYOUT)
    await chmod(enginePaths(notExecutable).python, 0o644)
    expect((await readEngineState(notExecutable)).status).toBe("missing")
  })

  test("is ready only with all three pinned versions", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, PINNED_LAYOUT)
    expect(await readEngineState(stateDir)).toEqual({
      status: "ready",
      venv: enginePaths(stateDir).venv,
      python_version: PYTHON_VERSION,
      sudachipy_version: SUDACHIPY_VERSION,
      dictionary_version: DICTIONARY_VERSION,
    })
  })

  test("follows the interpreter symlink uv makes", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, { ...PINNED_LAYOUT, python: false })
    const target = join(await tempDir(), "python3.12")
    await writeFile(target, "#!/bin/sh\n")
    await chmod(target, 0o755)
    await symlink(target, enginePaths(stateDir).python)
    expect((await readEngineState(stateDir)).status).toBe("ready")
  })

  test("accepts case and hyphen/underscore variants of distribution names", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, PINNED_LAYOUT)
    const site = join(enginePaths(stateDir).venv, "lib/python3.12/site-packages")
    await rename(
      join(site, `sudachipy-${SUDACHIPY_VERSION}.dist-info`),
      join(site, `SudachiPy-${SUDACHIPY_VERSION}.dist-info`),
    )
    await rename(
      join(site, `sudachidict_core-${DICTIONARY_VERSION}.dist-info`),
      join(site, `SudachiDict-Core-${DICTIONARY_VERSION}.dist-info`),
    )
    expect((await readEngineState(stateDir)).status).toBe("ready")
  })

  test.each([
    { ...PINNED_LAYOUT, pythonVersion: "3.11.9" },
    { ...PINNED_LAYOUT, sudachipy: "0.6.10" },
    { ...PINNED_LAYOUT, dictionary: "20250129" },
    { pythonVersion: PYTHON_VERSION },
  ])("reports mismatched or missing packages: %j", async (layout: VenvLayout) => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, layout)
    expect(await readEngineState(stateDir)).toMatchObject({
      status: "mismatch",
      python_version: layout.pythonVersion,
      sudachipy_version: layout.sudachipy ?? null,
      dictionary_version: layout.dictionary ?? null,
    })
  })

  test("is a mismatch when the config names no Python version", async () => {
    const stateDir = await tempDir()
    await writeVenv(stateDir, PINNED_LAYOUT)
    await writeFile(join(enginePaths(stateDir).venv, "pyvenv.cfg"), "home = /somewhere\n")
    expect(await readEngineState(stateDir)).toMatchObject({ status: "mismatch", python_version: null })
  })
})
