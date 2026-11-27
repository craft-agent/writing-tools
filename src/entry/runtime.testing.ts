import { expect } from "bun:test"
import { z } from "zod"
import { defineTool, type ToolContext } from "../core"
import { PROJECT } from "../project"
import type { RuntimeOptions } from "./runtime"

/** The environment every entry point is given in its tests: a marker that tells it from `process.env`. */
export function runtimeFixture(): Required<RuntimeOptions> {
  return { env: { MARKER: "injected" } }
}

/** An add tool of `alpha` that records the context its `targets` and its `execute` get, and answers with the marker it reads from the runtime's environment. */
export function runtimeProbe() {
  const options = runtimeFixture()
  const targets: ToolContext[] = []
  const executions: ToolContext[] = []
  const spec = defineTool({
    id: "demo_runtime_probe",
    title: "Runtime probe",
    description: "Records the context supplied to targets and execution.",
    toolset: "alpha",
    class: "add",
    input: z.object({}),
    output: z.object({ marker: z.string() }),
    targets(_args, ctx) {
      targets.push(ctx)
      return ["runtime-target"]
    },
    async execute(_args, ctx) {
      executions.push(ctx)
      return { marker: ctx.runtime!.env.MARKER! }
    },
  })
  /** Expects the context to carry the package's command line and the injected environment. */
  function check(ctx: ToolContext) {
    expect(ctx.runtime?.cli).toBe(PROJECT.cli)
    expect(ctx.runtime?.env).toBe(options.env)
  }
  return { options, spec, targets, executions, check }
}
