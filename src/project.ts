import { CONVENTION_NAMES, CONVENTIONS, type OptionSpec } from "./core"

/** The ten conventions as `text` settings, each limited to its values; the table is the core's, so the settings and the arguments agree. */
const CONVENTION_OPTIONS: Record<string, OptionSpec> = Object.fromEntries(
  CONVENTION_NAMES.map((name) => [name, { type: "text", values: CONVENTIONS[name].values }]),
)

/**
 * The three thresholds of the readability rules as bounded whole-number
 * settings: the characters past which a sentence is long, the kanji in a row
 * past which a run is reported, and the case-marking の in a row past which a
 * chain is reported. Unset, the genre's value applies.
 */
const THRESHOLD_OPTIONS: Record<string, OptionSpec> = {
  sentence_length: { type: "number", integer: true, min: 20, max: 400 },
  kanji_run: { type: "number", integer: true, min: 4, max: 20 },
  no_chain: { type: "number", integer: true, min: 2, max: 10 },
}

/** What makes this package itself; a project made from the starter sets these once (the setup script does). */
export const PROJECT = {
  /** The plugin, MCP server and program name. */
  name: "writing-tools",
  /** The command line the Hermes plugin calls. */
  cli: "writing-tools-cli",
  /** Every tool ID starts with `<toolPrefix>_`. */
  toolPrefix: "writing",
  /** Every setting's environment variable is `<envPrefix>_<SETTING>`. */
  envPrefix: "WRITING_TOOLS",
  /** The toolsets, in the order `all` lists them. */
  toolsets: ["text"] as readonly string[],
  /** The toolsets on when a setting names none. */
  defaultToolsets: ["text"] as readonly string[],
  /** The package's own settings, which the tools themselves read: each snake_case name and its type, with bounds when it needs them. */
  options: {
    state_dir: "path",
    ...CONVENTION_OPTIONS,
    rules: "list",
    exclude_rules: "list",
    ...THRESHOLD_OPTIONS,
  } as Readonly<Record<string, OptionSpec>>,
  /** The environment variables the tools read besides the settings, which Codex forwards to the server after them. */
  toolVariables: ["XDG_STATE_HOME"] as readonly string[],
} as const
