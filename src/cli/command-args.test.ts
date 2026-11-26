import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { ToolError } from "../core"
import { PROJECT } from "../project"
import { handleCommandError, parseCommandStateDir, parseFlagArgs } from "./command-args"
import { EXIT_FAILED, EXIT_USAGE } from "./command-io"

const SPEC = { values: ["--value"], switches: ["--yes"] } as const

function collect(env: Record<string, string | undefined> = {}) {
  let stderr = ""
  return { io: { env, stdout: () => {}, stderr: (text: string) => (stderr += text) }, stderr: () => stderr }
}

describe("parseFlagArgs", () => {
  test("takes both value forms and the last value wins", () => {
    expect(parseFlagArgs(["--value", "first", "--value=last"], SPEC).values).toEqual({ "--value": "last" })
  })

  test("takes switches and leaves unrecognized arguments in order", () => {
    const parsed = parseFlagArgs(["--state-dir", "/s", "--yes", "--value", "a", "extra"], SPEC)
    expect(parsed.switches.has("--yes")).toBe(true)
    expect(parsed.rest).toEqual(["--state-dir", "/s", "extra"])
  })

  test.each([
    [["--value"], "--value"],
    [["--value="], "--value"],
    [["--value", "--yes"], "--value"],
    [["--yes=true"], "--yes"],
  ])("%j is a usage error naming the flag", (argv, flag) => {
    expect(() => parseFlagArgs(argv, SPEC)).toThrow(flag)
  })
})

describe("parseCommandStateDir", () => {
  const PREFIX = PROJECT.envPrefix

  test("takes both flag forms and expands ~", () => {
    const { io } = collect({ HOME: "/home/someone" })
    expect(parseCommandStateDir(["--state-dir", "/flag"], io)).toEqual({ stateDir: "/flag", fromFlag: true })
    expect(parseCommandStateDir(["--state-dir=/flag"], io)).toEqual({ stateDir: "/flag", fromFlag: true })
    expect(parseCommandStateDir(["--state-dir", "~/state"], io).stateDir).toBe("/home/someone/state")
  })

  test("falls back to the setting variable, XDG_STATE_HOME, then home", () => {
    const home = "/home/someone"
    const env = { HOME: home, XDG_STATE_HOME: "/xdg" }
    expect(parseCommandStateDir([], collect({ ...env, [`${PREFIX}_STATE_DIR`]: "/env" }).io)).toEqual({
      stateDir: "/env",
      fromFlag: false,
    })
    expect(parseCommandStateDir([], collect(env).io)).toEqual({
      stateDir: join("/xdg", PROJECT.name),
      fromFlag: false,
    })
    expect(parseCommandStateDir([], collect({ HOME: home, XDG_STATE_HOME: "relative" }).io)).toEqual({
      stateDir: join(home, ".local", "state", PROJECT.name),
      fromFlag: false,
    })
  })

  test("the flag wins over the variable", () => {
    expect(
      parseCommandStateDir(["--state-dir", "/flag"], collect({ [`${PREFIX}_STATE_DIR`]: "/env" }).io).stateDir,
    ).toBe("/flag")
  })

  test("reads no other setting", () => {
    const env = { [`${PREFIX}_UNATTENDED`]: "maybe", [`${PREFIX}_GRANT_KEY`]: "short" }
    expect(parseCommandStateDir(["--state-dir", "/flag"], collect(env).io).stateDir).toBe("/flag")
    for (const arg of ["--unattended", "--grants-dir=/g", "--tools=a", "--nope", "stray"]) {
      expect(() => parseCommandStateDir([arg], collect().io)).toThrow("Unknown option")
    }
  })

  test("refuses a relative path", () => {
    expect(() => parseCommandStateDir(["--state-dir", "relative"], collect().io)).toThrow(
      "--state-dir must be an absolute path.",
    )
  })
})

describe("handleCommandError", () => {
  test("prints one prefixed line and chooses the exit by mode", () => {
    const error = new ToolError("not_found", "lost")
    const { io, stderr } = collect()
    expect(handleCommandError(error, io)).toBe(EXIT_FAILED)
    expect(stderr()).toBe(`${PROJECT.cli}: lost\n`)
    expect(handleCommandError(error, io, { mode: "usage" })).toBe(EXIT_USAGE)
    expect(handleCommandError(error, io, { mode: "auto" })).toBe(EXIT_FAILED)
    expect(handleCommandError(new ToolError("invalid_argument", "bad"), io, { mode: "auto" })).toBe(EXIT_USAGE)
  })

  test("reports cancellation only when given a message", () => {
    const abort = Object.assign(new Error("stopped"), { name: "AbortError" })
    const said = collect()
    expect(handleCommandError(abort, said.io, { abortMessage: "Cancelled." })).toBe(EXIT_FAILED)
    expect(said.stderr()).toBe(`${PROJECT.cli}: Cancelled.\n`)
    const unsaid = collect()
    expect(handleCommandError(abort, unsaid.io)).toBe(EXIT_FAILED)
    expect(unsaid.stderr()).toBe(`${PROJECT.cli}: Unexpected error; the command failed.\n`)
  })

  test("does not expose unexpected errors' details", () => {
    const { io, stderr } = collect()
    expect(handleCommandError(new TypeError("secret detail"), io)).toBe(EXIT_FAILED)
    expect(stderr()).toBe(`${PROJECT.cli}: Unexpected error; the command failed.\n`)
  })
})
