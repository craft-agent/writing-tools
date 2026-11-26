import { isAbortError, isToolError, ToolError } from "../core"
import { parseStateDirOnly } from "../entry/settings"
import { PROJECT } from "../project"
import { EXIT_FAILED, EXIT_USAGE, type CommandIo } from "./command-io"

export const STATE_DIR_FLAG = "--state-dir"

/** The flags a command takes: value flags and switches. */
export type FlagParserSpec<V extends string = string, S extends string = string> = {
  values?: readonly V[]
  switches?: readonly S[]
}

/** What `parseFlagArgs` found; `rest` preserves all unrecognized arguments. */
export type ParsedFlagArgs<V extends string, S extends string> = {
  values: Partial<Record<V, string>>
  switches: Set<S>
  rest: string[]
}

/** The resolved state directory and whether the person named it with a flag. */
export type CommandStateDir = { stateDir: string; fromFlag: boolean }

export type CommandErrorMode = "failed" | "usage" | "auto"
export type CommandErrorOptions = { abortMessage?: string; mode?: CommandErrorMode }

const UNEXPECTED_MESSAGE = "Unexpected error; the command failed."

export function usageError(message: string): ToolError {
  return new ToolError("invalid_argument", message)
}

/** Writes one line on standard error, led by the program's name. */
export function printCommandError(io: CommandIo, message: string): void {
  io.stderr(`${PROJECT.cli}: ${message}\n`)
}

/** Reports a command failure without exposing unexpected errors' details. */
export function handleCommandError(error: unknown, io: CommandIo, options: CommandErrorOptions = {}): number {
  if (isToolError(error)) {
    printCommandError(io, error.message)
    const { mode = "failed" } = options
    if (mode === "usage") return EXIT_USAGE
    if (mode === "auto" && error.code === "invalid_argument") return EXIT_USAGE
    return EXIT_FAILED
  }
  if (options.abortMessage !== undefined && isAbortError(error)) {
    printCommandError(io, options.abortMessage)
    return EXIT_FAILED
  }
  printCommandError(io, UNEXPECTED_MESSAGE)
  return EXIT_FAILED
}

/** Extracts known flags, rejecting missing values or values on switches. */
export function parseFlagArgs<V extends string = string, S extends string = string>(
  argv: string[],
  spec: FlagParserSpec<V, S>,
): ParsedFlagArgs<V, S> {
  const values: Partial<Record<V, string>> = {}
  const switches = new Set<S>()
  const rest: string[] = []
  const valueFlags = new Set<string>(spec.values)
  const switchFlags = new Set<string>(spec.switches)

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const equals = arg.indexOf("=")
    const flag = equals === -1 ? arg : arg.slice(0, equals)
    if (valueFlags.has(flag)) {
      const value = equals === -1 ? argv[++i] : arg.slice(equals + 1)
      if (value === undefined || value === "" || (equals === -1 && value.startsWith("--"))) {
        throw usageError(`Option ${flag} needs a value.`)
      }
      values[flag as V] = value
    } else if (switchFlags.has(flag)) {
      if (equals !== -1) throw usageError(`Option ${flag} takes no value.`)
      switches.add(flag as S)
    } else {
      rest.push(arg)
    }
  }
  return { values, switches, rest }
}

/** Reads only `--state-dir`, with the same environment fallbacks as tool settings. */
export function parseCommandStateDir(argv: string[], io: CommandIo): CommandStateDir {
  const { values, rest } = parseFlagArgs(argv, { values: [STATE_DIR_FLAG] })
  const flag = values[STATE_DIR_FLAG]
  const args = flag === undefined ? rest : [`${STATE_DIR_FLAG}=${flag}`, ...rest]
  return { stateDir: parseStateDirOnly(args, io.env, io.profile).state_dir, fromFlag: flag !== undefined }
}
