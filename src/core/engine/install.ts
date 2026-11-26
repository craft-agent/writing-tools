import { constants } from "node:fs"
import { access, stat } from "node:fs/promises"
import { ToolError, isToolError } from "../errors"
import type { ExecResult } from "../exec"
import { exitFailure, NETWORK_PASS, run, type RunOptions } from "../runner"
import { ensurePrivateDir } from "./private-dir"
import {
  DICTIONARY_VERSION,
  PYTHON_VERSION,
  SUDACHIPY_VERSION,
  enginePaths,
  readEngineState,
  stateRoot,
  type EngineState,
} from "./state"

/** What `installEngine` needs. */
export type InstallOptions = {
  stateDir: string
  lockFile: string
  env: Readonly<Record<string, string | undefined>>
  signal?: AbortSignal
  progress?(line: string): void
}

const UV = "uv"
const UV_INSTALL_URL = "https://docs.astral.sh/uv/getting-started/installation/"
const UV_VERSION_TIMEOUT_MS = 15_000
const VENV_TIMEOUT_MS = 5 * 60_000
const SYNC_TIMEOUT_MS = 10 * 60_000
const UV_SET = { UV_NO_CONFIG: "1", UV_NO_PROGRESS: "1" } as const
const UV_PASS = [
  "UV_CACHE_DIR",
  "UV_PYTHON_INSTALL_DIR",
  "UV_PYTHON_INSTALL_MIRROR",
  "UV_DEFAULT_INDEX",
  "UV_INDEX_URL",
  "UV_NATIVE_TLS",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  ...NETWORK_PASS,
] as const

async function requireReadableFile(path: string): Promise<void> {
  try {
    if ((await stat(path)).isFile()) {
      await access(path, constants.R_OK)
      return
    }
  } catch {
    // Reported below, the same way as a directory.
  }
  throw new ToolError("internal_error", `The engine's requirements file is missing from the package: ${path}.`)
}

function uvOptions(options: InstallOptions, timeoutMs: number): RunOptions {
  return { env: options.env, pass: UV_PASS, set: UV_SET, timeoutMs, signal: options.signal, name: UV }
}

async function runUv(args: string[], options: InstallOptions, timeoutMs: number): Promise<ExecResult> {
  const result = await run([UV, ...args], uvOptions(options, timeoutMs))
  if (result.code !== 0) throw exitFailure(result, UV)
  return result
}

async function requireUv(options: InstallOptions): Promise<void> {
  try {
    await runUv(["--version"], options, UV_VERSION_TIMEOUT_MS)
  } catch (error) {
    if (isToolError(error) && error.code === "not_found") {
      throw new ToolError("not_found", `uv was not found; install it (${UV_INSTALL_URL}) and run this again.`, {
        cause: error,
        details: { program: UV },
      })
    }
    throw error
  }
}

function notReady(state: EngineState): ToolError {
  const found = (version: string | null) => version ?? "none"
  return new ToolError(
    "upstream_error",
    `The engine is not ready after the install: found SudachiPy ${found(state.sudachipy_version)}, sudachidict_core ${found(state.dictionary_version)}, Python ${found(state.python_version)}, but this release pins SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core ${DICTIONARY_VERSION}, Python ${PYTHON_VERSION}.`,
    {
      details: {
        found_sudachipy: state.sudachipy_version,
        found_dictionary: state.dictionary_version,
        found_python: state.python_version,
        pinned_sudachipy: SUDACHIPY_VERSION,
        pinned_dictionary: DICTIONARY_VERSION,
        pinned_python: PYTHON_VERSION,
      },
    },
  )
}

/**
 * Builds the engine's private venv with uv from hashed requirements, using only
 * wheels. A venv on another Python is rebuilt; one on the pin is synced.
 */
export async function installEngine(options: InstallOptions): Promise<EngineState> {
  await requireReadableFile(options.lockFile)
  await requireUv(options)

  const root = stateRoot(options.stateDir)
  const { dir, venv, python } = enginePaths(options.stateDir)
  await ensurePrivateDir(root)
  await ensurePrivateDir(dir)

  if ((await readEngineState(options.stateDir)).python_version !== PYTHON_VERSION) {
    options.progress?.(`Creating the engine's Python ${PYTHON_VERSION} environment…`)
    await runUv(
      ["venv", venv, "--python", PYTHON_VERSION, "--managed-python", "--clear", "--quiet"],
      options,
      VENV_TIMEOUT_MS,
    )
  }

  options.progress?.(
    `Installing SudachiPy ${SUDACHIPY_VERSION} and sudachidict_core ${DICTIONARY_VERSION} from the pinned requirements…`,
  )
  await runUv(
    ["pip", "sync", "--python", python, "--require-hashes", "--strict", "--no-build", "--quiet", options.lockFile],
    options,
    SYNC_TIMEOUT_MS,
  )

  const state = await readEngineState(options.stateDir)
  if (state.status !== "ready") throw notReady(state)
  return state
}
