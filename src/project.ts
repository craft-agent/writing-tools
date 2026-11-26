import type { OptionSpec } from "./core"

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
  toolsets: [] as readonly string[],
  /** The toolsets on when a setting names none. */
  defaultToolsets: [] as readonly string[],
  /** The package's own settings, which the tools themselves read: each snake_case name and its type, with bounds when it needs them. */
  options: {
    state_dir: "path",
    register: { type: "text", values: ["document", "polite", "plain"] },
    latin_spacing: { type: "text", values: ["document", "spaced", "unspaced"] },
    unit_spacing: { type: "text", values: ["document", "spaced", "unspaced"] },
    alnum_width: { type: "text", values: ["document", "halfwidth", "fullwidth"] },
    bracket_width: { type: "text", values: ["document", "fullwidth", "halfwidth"] },
    punctuation: { type: "text", values: ["document", "ten_maru", "comma_period", "comma_maru"] },
    quotes: { type: "text", values: ["document", "corner", "double"] },
    range_mark: { type: "text", values: ["document", "wave_dash", "fullwidth_tilde", "hyphen"] },
    long_vowel: { type: "text", values: ["document", "keep", "drop"] },
    counter_ka: { type: "text", values: ["document", "hiragana", "small_ke", "katakana"] },
    rules: "list",
    exclude_rules: "list",
  } as Readonly<Record<string, OptionSpec>>,
  /** The environment variables the tools read besides the settings, which Codex forwards to the server after them. */
  toolVariables: ["XDG_STATE_HOME"] as readonly string[],
} as const
