import { afterEach, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { DICTIONARY_VERSION, PYTHON_VERSION, SUDACHIPY_VERSION, enginePaths } from "../core"
import { NO_UV_ENV, fakeUv, removeTempDirs, tempDir } from "../core/engine/engine.testing"
import { PROJECT } from "../project"
import { EXIT_FAILED, EXIT_OK } from "./cli"
import { STATE_DIR_FLAG } from "./command-args"
import { ownDirWithLock } from "./engine.testing"
import { cli } from "./testing"

afterEach(removeTempDirs)

async function install(overrides: Parameters<typeof cli>[2] = {}) {
  const uv = await fakeUv()
  const stateDir = join(await tempDir(), "state")
  const run = await cli(["engine", "install", STATE_DIR_FLAG, stateDir], "", {
    env: uv.env,
    ownDir: await ownDirWithLock(),
    ...overrides,
  })
  return { run, uv, stateDir }
}

describe("engine install", () => {
  test("prints progress on stderr and the ready result on stdout", async () => {
    const { run, uv, stateDir } = await install()
    expect(run.code).toBe(EXIT_OK)
    expect(run.stdout).toBe(
      `The engine is ready: SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core ${DICTIONARY_VERSION}, Python ${PYTHON_VERSION} in ${enginePaths(stateDir).venv}.\n`,
    )
    expect(run.stderr).toBe(
      `Creating the engine's Python ${PYTHON_VERSION} environment…\nInstalling SudachiPy ${SUDACHIPY_VERSION} and sudachidict_core ${DICTIONARY_VERSION} from the pinned requirements…\n`,
    )
    expect(await uv.calls()).toHaveLength(3)
  })

  test("reads the shipped lock file and takes the equals form of the state flag", async () => {
    const uv = await fakeUv()
    const ownDir = await ownDirWithLock()
    const stateDir = join(await tempDir(), "state")
    const run = await cli(["engine", "install", `${STATE_DIR_FLAG}=${stateDir}`], "", { env: uv.env, ownDir })
    expect(run.code).toBe(EXIT_OK)
    expect((await uv.calls())[2]).toEndWith(` ${join(ownDir, "engine", "requirements.lock")}`)
    expect((await uv.calls())[2]).toContain("--require-hashes --strict --no-build")
  })

  test("uses the environment's state directory without a flag", async () => {
    const uv = await fakeUv()
    const stateDir = join(await tempDir(), "state")
    const run = await cli(["engine", "install"], "", {
      env: { ...uv.env, DEMO_STATE_DIR: stateDir },
      ownDir: await ownDirWithLock(),
    })
    expect(run.code).toBe(EXIT_OK)
    expect(run.stdout).toContain(enginePaths(stateDir).venv)
  })

  test("reports uv failures as one prefixed line", async () => {
    const uv = await fakeUv()
    await uv.set("fail-sync", "error: hash mismatch\n")
    const { run } = await install({ env: uv.env })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stdout).toBe("")
    expect(run.stderr.split("\n").at(-2)).toBe(`${PROJECT.cli}: uv failed (exit 3): error: hash mismatch`)
  })

  test("reports a missing uv with the install URL", async () => {
    const { run } = await install({ env: NO_UV_ENV })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stderr).toBe(
      `${PROJECT.cli}: uv was not found; install it (https://docs.astral.sh/uv/getting-started/installation/) and run this again.\n`,
    )
  })

  test("reports cancellation", async () => {
    const controller = new AbortController()
    controller.abort()
    const { run } = await install({ signal: controller.signal })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stderr).toBe(`${PROJECT.cli}: Cancelled.\n`)
    expect(run.stdout).toBe("")
  })

  test("reports missing package requirements", async () => {
    const { run } = await install({ ownDir: await tempDir() })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stderr).toStartWith(`${PROJECT.cli}: The engine's requirements file is missing from the package: `)
  })

  test("reports an unknown install directory", async () => {
    const { run } = await install({ ownDir: undefined })
    expect(run.code).toBe(EXIT_FAILED)
    expect(run.stderr).toBe(`${PROJECT.cli}: The directory the tools are installed in is not known.\n`)
  })
})
