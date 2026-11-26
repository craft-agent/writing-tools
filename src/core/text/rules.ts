import type { ResolvedConventions } from "./conventions"
import type { TextDocument } from "./model"

/** The checks that exist, in the order the report lists them; the others of `docs/conventions.md` are added with their rules. */
export const CHECKS = ["notation", "expression"] as const

/** The name of a check. */
export type CheckName = (typeof CHECKS)[number]

/** The severities from the one that matters most. */
export const SEVERITIES = ["critical", "warn", "info"] as const

/** Who pays for a finding: `critical` any reader, `warn` most readers, `info` depends on context. */
export type Severity = (typeof SEVERITIES)[number]

/** One rule of a check. */
export type RuleSpec = {
  /** snake_case and unique across the checks; the `rules` settings and a finding name it, so renaming it is a breaking change. */
  id: string
  check: CheckName
  severity: Severity
  /** `false` for a rule that prefers one legitimate wording to another: it runs only when `rules` names it. */
  defaultOn: boolean
  /** Whether the rule needs the engine's morphology. */
  morphology: boolean
  /** `<file>#<anchor>` in the skill's references, where the rule is explained. */
  reference: string
}

/** What a rule found, before the report places it: offsets into `doc.text`, `end` exclusive. */
export type RawFinding = {
  rule: string
  start: number
  end: number
  reason: string
  /** Overrides the rule's severity for this finding. */
  severity?: Severity
}

/** What a check reads: the document, what each convention is held to, and which rules run. */
export type CheckContext = {
  doc: TextDocument
  conventions: ResolvedConventions
  /** Whether a rule of the registry is on for this call; a check reports only the rules that are. */
  enabled(rule: string): boolean
}

/** A check: its rules, and the function that finds them in a document. */
export type CheckSpec = {
  name: CheckName
  rules: readonly RuleSpec[]
  run(ctx: CheckContext): RawFinding[]
}
