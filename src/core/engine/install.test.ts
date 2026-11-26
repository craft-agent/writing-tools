import { afterEach, describe, expect, test } from "bun:test"
import { chmod, stat, symlink } from "node:fs/promises"
import { join } from "node:path"
import { isAbortError, isToolError } from "../errors"
import { installEngine } from "./install"
import { DICTIONARY_VERSION, PYTHON_VERSION, SUDACHIPY_VERSION, enginePaths } from "./state"
import { NO_UV_ENV, PINNED_LAYOUT, fakeUv, lockFile, removeTempDirs, tempDir, writeVenv } from "./engine.testing"

afterEach(removeTempDirs)

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return undefined
}

async function mode(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777
}

async function freshStateDir(): Promise<string> {
  return join(await tempDir(), "state")
}

describe("installEngine", () => {
  test("creates a private venv and syncs strictly from hashed wheels", async () => {
    const uv = await fakeUv()
    const file = await lockFile()
    const stateDir = await freshStateDir()
    const progress: string[] = []
    const { venv, python } = enginePaths(stateDir)
    expect(
      await installEngine({ stateDir, lockFile: file, env: uv.env, progress: (line) => progress.push(line) }),
    ).toEqual({
      status: "ready",
      venv,
      python_version: PYTHON_VERSION,
      sudachipy_version: SUDACHIPY_VERSION,
      dictionary_version: DICTIONARY_VERSION,
    })
    expect(await uv.calls()).toEqual([
      "--version",
      `venv ${venv} --python ${PYTHON_VERSION} --managed-python --clear --quiet`,
      `pip sync --python ${python} --require-hashes --strict --no-build --quiet ${file}`,
    ])
    expect(progress).toEqual([
      `Creating the engine's Python ${PYTHON_VERSION} environment…`,
      `Installing SudachiPy ${SUDACHIPY_VERSION} and sudachidict_core ${DICTIONARY_VERSION} from the pinned requirements…`,
    ])
    expect(await mode(stateDir)).toBe(0o700)
    expect(await mode(enginePaths(stateDir).dir)).toBe(0o700)
  })

  test("passes network settings, cache and fixed settings, but no stray variables", async () => {
    const uv = await fakeUv()
    await installEngine({ stateDir: await freshStateDir(), lockFile: await lockFile(), env: uv.env })
    expect(await uv.environments()).toEqual(
      Array(3).fill(
        "UV_NO_CONFIG=1 UV_CACHE_DIR=/cache/uv STRAY= HTTPS_PROXY=https://proxy.example SSL_CERT_FILE=/cert.pem",
      ),
    )
  })

  test("keeps the pinned Python and syncs mismatched packages", async () => {
    const uv = await fakeUv()
    const stateDir = await freshStateDir()
    await writeVenv(stateDir, { ...PINNED_LAYOUT, dictionary: "20250129" })
    expect((await installEngine({ stateDir, lockFile: await lockFile(), env: uv.env })).status).toBe("ready")
    expect(await uv.calls()).toHaveLength(2)
    expect((await uv.calls())[1]).toStartWith("pip sync")
  })

  test.each([{ pythonVersion: "3.11.9" }, { python: false }])(
    "rebuilds unusable or other Python: %j",
    async (layout) => {
      const uv = await fakeUv()
      const stateDir = await freshStateDir()
      await writeVenv(stateDir, { ...PINNED_LAYOUT, ...layout })
      expect((await installEngine({ stateDir, lockFile: await lockFile(), env: uv.env })).python_version).toBe(
        PYTHON_VERSION,
      )
      expect((await uv.calls())[1]).toContain(`--python ${PYTHON_VERSION} --managed-python --clear`)
    },
  )

  test("tightens existing state and engine directories", async () => {
    const uv = await fakeUv()
    const stateDir = await tempDir()
    const options = { stateDir, lockFile: await lockFile(), env: uv.env }
    await installEngine(options)
    await chmod(stateDir, 0o755)
    await chmod(enginePaths(stateDir).dir, 0o755)
    await installEngine(options)
    expect(await mode(stateDir)).toBe(0o700)
    expect(await mode(enginePaths(stateDir).dir)).toBe(0o700)
  })

  test("refuses a symlink at the state root", async () => {
    const uv = await fakeUv()
    const stateDir = await freshStateDir()
    await symlink(await tempDir(), stateDir)
    const error = await failure(installEngine({ stateDir, lockFile: await lockFile(), env: uv.env }))
    expect(isToolError(error) && error.code).toBe("invalid_argument")
    expect((error as Error).message).toContain("a symlink is not followed")
  })
})

describe("installEngine failures", () => {
  test("requires a readable lock file before running anything or creating state", async () => {
    const uv = await fakeUv()
    const stateDir = await freshStateDir()
    for (const path of [join(await tempDir(), "absent"), await tempDir()]) {
      const error = await failure(installEngine({ stateDir, lockFile: path, env: uv.env }))
      expect(isToolError(error) && error.code).toBe("internal_error")
      expect((error as Error).message).toContain("requirements file is missing")
    }
    expect(await uv.calls()).toEqual([])
    expect(await failure(stat(stateDir))).toBeDefined()
  })

  test("a missing uv says how to install it", async () => {
    const error = await failure(
      installEngine({ stateDir: await freshStateDir(), lockFile: await lockFile(), env: NO_UV_ENV }),
    )
    expect(isToolError(error) && error.code).toBe("not_found")
    expect((error as Error).message).toContain("https://docs.astral.sh/uv/getting-started/installation/")
  })

  test.each(["fail-venv", "fail-sync"] as const)("reports %s with the last line of stderr", async (setting) => {
    const uv = await fakeUv()
    await uv.set(setting, "warning: first\nerror: wheels unavailable\n")
    const error = await failure(
      installEngine({ stateDir: await freshStateDir(), lockFile: await lockFile(), env: uv.env }),
    )
    expect(isToolError(error) && error.code).toBe("upstream_error")
    expect((error as Error).message).toEndWith("error: wheels unavailable")
  })

  test.each([
    ["dictionary-version", "20250129"],
    ["sudachipy-version", "0.6.10"],
    ["python-version", "3.11.9"],
  ] as const)(
    "rejects a wrong %s after installation, naming all found and pinned versions",
    async (setting, version) => {
      const uv = await fakeUv()
      await uv.set(setting, version)
      const error = await failure(
        installEngine({ stateDir: await freshStateDir(), lockFile: await lockFile(), env: uv.env }),
      )
      expect(isToolError(error) && error.code).toBe("upstream_error")
      expect((error as Error).message).toContain(version)
      expect((error as Error).message).toContain(
        `this release pins SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core ${DICTIONARY_VERSION}, Python ${PYTHON_VERSION}`,
      )
      expect((error as Error).message).toMatch(/found SudachiPy .+, sudachidict_core .+, Python .+, but/)
    },
  )

  test("an aborted signal runs nothing", async () => {
    const uv = await fakeUv()
    const controller = new AbortController()
    controller.abort()
    const error = await failure(
      installEngine({
        stateDir: await freshStateDir(),
        lockFile: await lockFile(),
        env: uv.env,
        signal: controller.signal,
      }),
    )
    expect(isAbortError(error)).toBe(true)
    expect(await uv.calls()).toEqual([])
  })
})
