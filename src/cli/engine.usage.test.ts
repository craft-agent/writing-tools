import { describe, expect, test } from "bun:test"
import { PROJECT } from "../project"
import { EXIT_USAGE } from "./cli"
import { cli } from "./testing"

const USAGE = `${PROJECT.cli}: Use engine install|status [--state-dir <path>].\n`

describe("engine command line", () => {
  test.each([[[]], [["nope"]], [["constructor"]], [["install-all"]]])(
    "engine %j without a known subcommand prints usage",
    async (args) => {
      const run = await cli(["engine", ...args])
      expect(run.code).toBe(EXIT_USAGE)
      expect(run.stdout).toBe("")
      expect(run.stderr).toBe(USAGE)
    },
  )

  test.each([
    [["install", "extra"], 'Unknown option "extra".'],
    [["status", "--bogus"], 'Unknown option "--bogus".'],
    [["status", "--read-only"], 'Unknown option "--read-only".'],
    [["install", "--toolsets=alpha"], 'Unknown option "--toolsets".'],
    [["install", "--state-dir"], "Option --state-dir needs a value."],
    [["status", "--state-dir="], "Option --state-dir needs a value."],
    [["status", "--state-dir", "--other"], "Option --state-dir needs a value."],
    [["status", "--state-dir", "relative"], "--state-dir must be an absolute path."],
  ])("engine %j is a usage error", async (args, message) => {
    const run = await cli(["engine", ...args])
    expect(run.code).toBe(EXIT_USAGE)
    expect(run.stdout).toBe("")
    expect(run.stderr).toBe(`${PROJECT.cli}: ${message}\n`)
  })

  test("ignores invalid variables of other settings", async () => {
    const run = await cli(["engine", "status", "--state-dir", "/nonexistent/state"], "", {
      env: { DEMO_UNATTENDED: "maybe", DEMO_GRANT_KEY: "short", DEMO_GRANTS_DIR: "relative" },
    })
    expect(run.code).toBe(1)
    expect(run.stdout).toStartWith("engine: not installed")
  })

  test("top-level usage mentions engine and list is unchanged", async () => {
    const unknown = await cli(["frobnicate"])
    expect(unknown.code).toBe(EXIT_USAGE)
    expect(unknown.stderr).toContain("or engine install|status.")
    const list = await cli(["list"])
    expect(list.code).toBe(0)
    expect(Array.isArray(JSON.parse(list.stdout))).toBe(true)
  })
})
