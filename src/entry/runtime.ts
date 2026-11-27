import type { ToolRuntime } from "../core"
import { PROJECT } from "../project"
import type { Environment } from "./state-dir"

/** What an entry point may replace in the runtime it gives its tools; each has a default, and a test supplies its own. */
export type RuntimeOptions = {
  /** Where the settings and the tools read their variables from; defaults to `process.env`. */
  env?: Environment
}

/** The runtime of a tool call: the package's command line and the environment. It reads nothing. */
export function createToolRuntime(options: RuntimeOptions = {}): ToolRuntime {
  return { cli: PROJECT.cli, env: options.env ?? process.env }
}
