import { afterEach, expect, test } from "bun:test"
import { cli } from "../cli/testing"
import { call, connect, runCleanups, settings } from "../mcp/testing"
import { PROFILE } from "../opencode/testing"
import type { V2Context, V2Tool } from "../opencode/types"
import { createV1Server } from "../opencode/v1"
import { createV2Setup } from "../opencode/v2"
import { runtimeProbe } from "./runtime.testing"

afterEach(runCleanups)

test("the command line's run and target give the tool a runtime made of its environment", async () => {
  const p = runtimeProbe()
  for (const command of ["run", "target"]) {
    const result = await cli([command, p.spec.id, "--cwd", "/work"], "{}", { specs: [p.spec], env: p.options.env })
    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
  }
  expect(p.executions).toHaveLength(1)
  expect(p.targets).toHaveLength(1)
  p.check(p.executions[0]!)
  p.check(p.targets[0]!)
})

test("the MCP server gives the tool the injected runtime", async () => {
  const p = runtimeProbe()
  const { client } = await connect([p.spec], settings(), {}, p.options)
  expect((await call(client, p.spec.id)).structuredContent).toEqual({ marker: "injected" })
  expect(p.executions).toHaveLength(1)
  p.check(p.executions[0]!)
})

test("OpenCode V1 shares one injected runtime between targets and execution", async () => {
  const p = runtimeProbe()
  const { tool } = await createV1Server([p.spec], { profile: PROFILE, ...p.options })({})
  const context = { directory: "/work", worktree: "/work", abort: new AbortController().signal, ask: async () => {} }
  expect(await tool[p.spec.id]!.execute({}, context)).toBe('{"marker":"injected"}')
  expect(p.targets).toHaveLength(1)
  expect(p.executions).toHaveLength(1)
  p.check(p.targets[0]!)
  p.check(p.executions[0]!)
  expect(p.targets[0]!.runtime).toBe(p.executions[0]!.runtime)
})

test("OpenCode V2 shares one injected runtime between targets and execution", async () => {
  const p = runtimeProbe()
  const tools: V2Tool[] = []
  const context: V2Context = {
    session: { get: async () => ({ location: { directory: "/work" } }) },
    permission: { assert: async () => {} },
    tool: { transform: async (callback) => callback({ add: (tool) => tools.push(tool) }) },
    skill: { transform: async () => {} },
  }
  await createV2Setup([p.spec], { profile: PROFILE, ...p.options })(context)
  const result = await tools[0]!.execute({}, { sessionID: "ses_test", signal: new AbortController().signal })
  expect(result.output).toEqual({ marker: "injected" })
  expect(p.targets).toHaveLength(1)
  expect(p.executions).toHaveLength(1)
  p.check(p.targets[0]!)
  p.check(p.executions[0]!)
  expect(p.targets[0]!.runtime).toBe(p.executions[0]!.runtime)
})
