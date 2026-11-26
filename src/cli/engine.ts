import { join } from "node:path"
import {
  DICTIONARY_VERSION,
  PYTHON_VERSION,
  SUDACHIPY_VERSION,
  ToolError,
  installEngine,
  readEngineState,
  type EngineState,
} from "../core"
import { PROJECT } from "../project"
import {
  STATE_DIR_FLAG,
  handleCommandError,
  parseCommandStateDir,
  printCommandError,
  type CommandStateDir,
} from "./command-args"
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, type CommandIo } from "./command-io"

const USAGE = `Use engine install|status [${STATE_DIR_FLAG} <path>].`
const LOCK_FILE_PARTS = ["engine", "requirements.lock"] as const
const UNKNOWN_VERSION = "unknown"
const SHELL_SAFE = /^[A-Za-z0-9_\/.,:=@%+-]+$/

function shellWord(value: string): string {
  return SHELL_SAFE.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`
}

function installCommand({ stateDir, fromFlag }: CommandStateDir): string {
  const command = `${PROJECT.cli} engine install`
  return fromFlag ? `${command} ${STATE_DIR_FLAG} ${shellWord(stateDir)}` : command
}

async function install(target: CommandStateDir, io: CommandIo): Promise<number> {
  try {
    if (io.ownDir === undefined) {
      throw new ToolError("internal_error", "The directory the tools are installed in is not known.")
    }
    const state = await installEngine({
      stateDir: target.stateDir,
      lockFile: join(io.ownDir, ...LOCK_FILE_PARTS),
      env: io.env,
      signal: io.signal,
      progress: (line) => io.stderr(`${line}\n`),
    })
    io.stdout(
      `The engine is ready: SudachiPy ${state.sudachipy_version}, sudachidict_core ${state.dictionary_version}, Python ${state.python_version} in ${state.venv}.\n`,
    )
    return EXIT_OK
  } catch (error) {
    return handleCommandError(error, io, { abortMessage: "Cancelled." })
  }
}

function statusLines(state: EngineState, target: CommandStateDir): string[] {
  switch (state.status) {
    case "ready":
      return [
        `engine: ready (SudachiPy ${state.sudachipy_version}, sudachidict_core ${state.dictionary_version}, Python ${state.python_version})`,
        `venv: ${state.venv}`,
      ]
    case "missing":
      return ["engine: not installed", `run: ${installCommand(target)}`]
    case "mismatch":
      return [
        `engine: needs reinstall (found SudachiPy ${state.sudachipy_version ?? UNKNOWN_VERSION}, sudachidict_core ${state.dictionary_version ?? UNKNOWN_VERSION}, Python ${state.python_version ?? UNKNOWN_VERSION}; this release pins SudachiPy ${SUDACHIPY_VERSION}, sudachidict_core ${DICTIONARY_VERSION}, Python ${PYTHON_VERSION})`,
        `run: ${installCommand(target)}`,
      ]
  }
}

async function status(target: CommandStateDir, io: CommandIo): Promise<number> {
  try {
    const state = await readEngineState(target.stateDir)
    io.stdout(`${statusLines(state, target).join("\n")}\n`)
    return state.status === "ready" ? EXIT_OK : EXIT_FAILED
  } catch (error) {
    return handleCommandError(error, io)
  }
}

const ACTIONS: Partial<Record<string, (target: CommandStateDir, io: CommandIo) => Promise<number>>> = {
  install,
  status,
}

/** Runs a person's engine command, with progress and errors on stderr and results on stdout. */
export async function runEngineCommand(argv: string[], io: CommandIo): Promise<number> {
  const [name, ...rest] = argv
  const action = name !== undefined && Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined
  if (!action) {
    printCommandError(io, USAGE)
    return EXIT_USAGE
  }
  let target: CommandStateDir
  try {
    target = parseCommandStateDir(rest, io)
  } catch (error) {
    return handleCommandError(error, io, { mode: "usage" })
  }
  return action(target, io)
}
