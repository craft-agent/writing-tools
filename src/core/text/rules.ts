import type { Token } from "../engine/tokens"
import type { ConventionName, ResolvedConventions } from "./conventions"
import type { TextDocument } from "./model"

/** The checks that exist, in the order the report lists them; the others of `docs/conventions.md` are added with their rules. */
export const CHECKS = ["notation", "expression"] as const

/** The name of a check. */
export type CheckName = (typeof CHECKS)[number]

/** The genres a call may name; `general` is the one that applies when it names none. */
export const GENRES = ["general", "technical", "business", "essay"] as const

/** The kind of writing the text is, which moves thresholds and turns off the formatting checks the kind expects to use. */
export type Genre = (typeof GENRES)[number]

/** The genre that applies when a call names none. */
export const DEFAULT_GENRE: Genre = "general"

/** The stances a call may name for a text whose sentence endings are held to one. */
export const STANCES = ["advice", "rule", "explanation"] as const

/** What the text's sentence endings are meant to be: a recommendation, a requirement or a description. */
export type Stance = (typeof STANCES)[number]

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
  /** The genres in which the rule runs; absent, every genre. In any other it is neither run nor listed in `not_run`. */
  genres?: readonly Genre[]
  /** `true` for a rule that judges against `stance`: it runs only when the call gives one, and is never listed in `not_run` for the lack of it. */
  needsStance?: true
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

/** What a check reads: the document, what each convention is held to, which rules run, the genre and the stance, and the tokens. */
export type CheckContext = {
  doc: TextDocument
  conventions: ResolvedConventions
  /** Whether a rule of the registry is on for this call; a check reports only the rules that are. */
  enabled(rule: string): boolean
  /** The genre the call holds the text to. */
  genre: Genre
  /** The stance the call holds the sentence endings to; `undefined` when it gave none. */
  stance: Stance | undefined
  /**
   * The engine's tokens by the index of the block in `doc.blocks`, their
   * offsets already offsets in `doc.text`. A block is absent when no engine ran
   * for the call, the block is not prose or a list item, or the engine skipped
   * it; a rule that needs tokens reads only the blocks present.
   */
  tokens: ReadonlyMap<number, readonly Token[]>
}

/**
 * What a check returns: its findings, and the value each `document`
 * convention it read settled on, for the report's `conventions`. A check
 * settles a convention only when it was not given a value.
 */
export type CheckResult = {
  findings: RawFinding[]
  settled?: Partial<Record<ConventionName, string>>
}

/** The findings and the settled values of every one of `results`, as one result. */
export function mergeResults(results: readonly CheckResult[]): CheckResult {
  const settled: Partial<Record<ConventionName, string>> = Object.assign({}, ...results.map((result) => result.settled))
  return {
    findings: results.flatMap((result) => result.findings),
    ...(Object.keys(settled).length > 0 ? { settled } : {}),
  }
}

/** A check: its rules, and the function that finds them in a document. */
export type CheckSpec = {
  name: CheckName
  rules: readonly RuleSpec[]
  run(ctx: CheckContext): CheckResult
}
