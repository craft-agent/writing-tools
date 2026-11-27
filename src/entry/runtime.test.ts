import { expect, test } from "bun:test"
import { PROJECT } from "../project"
import { createToolRuntime } from "./runtime"
import { runtimeFixture } from "./runtime.testing"

test("the runtime keeps the injected environment and reads nothing while it is made", () => {
  const options = runtimeFixture()
  options.env = new Proxy(
    {},
    {
      get: () => {
        throw new Error("must not read the environment")
      },
    },
  )
  const runtime = createToolRuntime(options)
  expect(runtime.cli).toBe(PROJECT.cli)
  expect(runtime.env).toBe(options.env)
})

test("the defaults are the package's command line and the process environment", () => {
  const runtime = createToolRuntime()
  expect(runtime.cli).toBe(PROJECT.cli)
  expect(runtime.env === process.env).toBe(true)
})
