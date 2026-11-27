import type { Token } from "../engine/tokens"
import type { Alignment } from "./align"
import type { ConventionName, ResolvedConventions } from "./conventions"
import type { TextDocument } from "./model"
import type { Outline, Term } from "./schemas"

/** The checks of `inspect`, which its `checks` argument may name, in the order the report lists them. `outline` and `terms` are inventories: they have no rules and draw no finding. */
export const INSPECT_CHECKS = ["notation", "expression", "readability", "outline", "terms"] as const

/** The checks that exist, in the order the report lists them: those of `inspect`, then `revision`, which only `compare` runs. */
export const CHECKS = [...INSPECT_CHECKS, "revision"] as const

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

/** A place in the original text of a `compare` call: offsets into its text, `end` exclusive. */
export type OriginalPlace = {
  start: number
  end: number
  /** `true` when the excerpt is read from the original, as for what the revision dropped; the revision otherwise. */
  excerpt?: true
}

/**
 * What a rule found, before the report places it: offsets into `doc.text`,
 * `end` exclusive. For what a revision dropped, `start` and `end` are where it
 * would have stood in the revision.
 */
export type RawFinding = {
  rule: string
  start: number
  end: number
  reason: string
  /** Overrides the rule's severity for this finding. */
  severity?: Severity
  /** Where the change stands in the original, for a finding of `compare` that has a place there. */
  original?: OriginalPlace
}

/** The length thresholds the call holds the text to, by the name of the setting that moves each. */
export type Thresholds = {
  /** The characters past which a sentence is long. */
  sentence_length: number
  /** The kanji in a row past which a run is reported. */
  kanji_run: number
  /** The case-marking の in a row past which a chain is reported. */
  no_chain: number
}

/** The original a `compare` call holds the revision against, and how the sentences of the two line up. */
export type Comparison = {
  original: TextDocument
  alignment: Alignment
  /** The engine's tokens of the original, as `CheckContext.tokens` holds the revision's: by the index of the block in `original.blocks`. */
  originalTokens: ReadonlyMap<number, readonly Token[]>
}

/** What a check reads: the document, what each convention is held to, which rules run, the genre, the thresholds and the stance, and the tokens. */
export type CheckContext = {
  /** The text the call inspects; for `compare`, the revision, whose tokens `tokens` holds. */
  doc: TextDocument
  conventions: ResolvedConventions
  /** Whether a rule of the registry is on for this call; a check reports only the rules that are. */
  enabled(rule: string): boolean
  /** The genre the call holds the text to. */
  genre: Genre
  /** The thresholds the call holds the text to: the settings' values, else the genre's. */
  thresholds: Thresholds
  /** The stance the call holds the sentence endings to; `undefined` when it gave none. */
  stance: Stance | undefined
  /**
   * The engine's tokens by the index of the block in `doc.blocks`, their
   * offsets already offsets in `doc.text`. A block is absent when no engine ran
   * for the call, the block is not prose or a list item, or the engine skipped
   * it; a rule that needs tokens reads only the blocks present.
   */
  tokens: ReadonlyMap<number, readonly Token[]>
  /** Present exactly in a `compare` call, which the `revision` check reads; the checks of `inspect` ignore it. */
  comparison?: Comparison
}

/**
 * What a check returns: its findings, and the value each `document`
 * convention it read settled on, for the report's `conventions`. A check
 * settles a convention only when it was not given a value. An inventory check
 * returns its inventory beside no findings: the headings and measures of the
 * text, or every term, uncut (the report applies the caps).
 */
export type CheckResult = {
  findings: RawFinding[]
  settled?: Partial<Record<ConventionName, string>>
  outline?: Outline
  /** In order of first use. */
  terms?: Term[]
}

/** The findings and the settled values of every one of `results`, as one result, and the inventory of the one that returned it. */
export function mergeResults(results: readonly CheckResult[]): CheckResult {
  const settled: Partial<Record<ConventionName, string>> = Object.assign({}, ...results.map((result) => result.settled))
  const outline = results.find((result) => result.outline !== undefined)?.outline
  const terms = results.find((result) => result.terms !== undefined)?.terms
  return {
    findings: results.flatMap((result) => result.findings),
    ...(Object.keys(settled).length > 0 ? { settled } : {}),
    ...(outline !== undefined ? { outline } : {}),
    ...(terms !== undefined ? { terms } : {}),
  }
}

/** A check: its rules, and the function that finds them in a document. An inventory check has no rules. */
export type CheckSpec = {
  name: CheckName
  rules: readonly RuleSpec[]
  run(ctx: CheckContext): CheckResult
}
