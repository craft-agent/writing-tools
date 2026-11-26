import { constants } from "node:fs"
import { access, readdir, readFile, stat } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"
import { ToolError } from "../errors"
import { isMissingPath } from "./missing-path"

/** The Python the engine's venv runs on; a venv on any other version is rebuilt. */
export const PYTHON_VERSION = "3.12.13"

/** The analyzer and dictionary releases pinned in the shipped requirements. */
export const SUDACHIPY_VERSION = "0.6.11"
export const DICTIONARY_VERSION = "20260723"

/** Where the engine lives under a state root. */
export type EnginePaths = { dir: string; venv: string; python: string }

/** What the venv holds, read from its files alone. */
export type EngineState = {
  status: "missing" | "mismatch" | "ready"
  venv: string
  python_version: string | null
  sudachipy_version: string | null
  dictionary_version: string | null
}

const PYVENV_CONFIG = "pyvenv.cfg"
const PYTHON_VERSION_LINE = /^version_info\s*=\s*(\S+)\s*$/m
const SUDACHIPY_DIST_INFO = /^sudachipy-(.+)\.dist-info$/i
const DICTIONARY_DIST_INFO = /^sudachidict[-_]core-(.+)\.dist-info$/i

/** Validates and normalizes the state directory without reading it. */
export function stateRoot(stateDir: string): string {
  if (!isAbsolute(stateDir)) throw new ToolError("invalid_argument", "State directory must be absolute.")
  return resolve(stateDir)
}

/** Where the engine lives under `stateDir`. */
export function enginePaths(stateDir: string): EnginePaths {
  const dir = join(stateRoot(stateDir), "engine")
  const venv = join(dir, "venv")
  return { dir, venv, python: join(venv, "bin", "python") }
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isFile()) return false
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function listOrEmpty(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch (error) {
    if (isMissingPath(error)) return []
    throw error
  }
}

async function packageVersions(venv: string): Promise<Pick<EngineState, "sudachipy_version" | "dictionary_version">> {
  const versions: Pick<EngineState, "sudachipy_version" | "dictionary_version"> = {
    sudachipy_version: null,
    dictionary_version: null,
  }
  const lib = join(venv, "lib")
  const pythons = (await listOrEmpty(lib)).filter((name) => name.startsWith("python")).sort()
  for (const python of pythons) {
    for (const entry of (await listOrEmpty(join(lib, python, "site-packages"))).sort()) {
      versions.sudachipy_version ??= SUDACHIPY_DIST_INFO.exec(entry)?.[1] ?? null
      versions.dictionary_version ??= DICTIONARY_DIST_INFO.exec(entry)?.[1] ?? null
    }
  }
  return versions
}

/**
 * Reads the venv's files without running a program. An unusable interpreter
 * or unreadable config is `missing`; versions other than the pins are `mismatch`.
 */
export async function readEngineState(stateDir: string): Promise<EngineState> {
  const { venv, python } = enginePaths(stateDir)
  const missing: EngineState = {
    status: "missing",
    venv,
    python_version: null,
    sudachipy_version: null,
    dictionary_version: null,
  }
  if (!(await isExecutableFile(python))) return missing
  let config: string
  try {
    config = await readFile(join(venv, PYVENV_CONFIG), "utf8")
  } catch {
    return missing
  }
  const python_version = PYTHON_VERSION_LINE.exec(config)?.[1] ?? null
  const versions = await packageVersions(venv)
  const ready =
    python_version === PYTHON_VERSION &&
    versions.sudachipy_version === SUDACHIPY_VERSION &&
    versions.dictionary_version === DICTIONARY_VERSION
  return { status: ready ? "ready" : "mismatch", venv, python_version, ...versions }
}
