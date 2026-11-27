/** What an entry point supplies to a tool beside the call's own context. */
export type ToolRuntime = {
  /** The command line a person runs, as a recovery command names it. */
  cli: string
  /** The environment a tool reads its variables from, and hands to the programs it runs. */
  env: Readonly<Record<string, string | undefined>>
}
