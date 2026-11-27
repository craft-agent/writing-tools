import type { ToolOptions } from "../../tool"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import { DEFAULT_GENRE } from "../rules"
import { checkContext } from "../rules.testing"
import type { NotRun } from "../schemas"
import { selectRules } from "../selection"
import { TOKEN_RULES, tokensOf, unavailable, type Hit } from "./expression.tokens.testing"
import type { Given } from "./notation.testing"
import { readabilityCheck } from "./readability"
import { resolveThresholds } from "./thresholds"

/** The rules of the readability check that read tokens, all on by default. */
export const READABILITY_TOKEN_RULES = ["no_chain", "double_negative", "buried_list"]

/** What a call without an engine lists as not run for `rules` of the readability check. */
export function unavailableReadability(...rules: string[]): NotRun[] {
  return rules.map((rule) => ({ check: "readability", rule, reason: "morphology_unavailable" }))
}

/** What a call of every check without an engine lists as not run: the rules on by default that read tokens, check by check. */
export const ALL_TOKEN_RULES_NOT_RUN: NotRun[] = [
  ...unavailable(...TOKEN_RULES),
  ...unavailableReadability(...READABILITY_TOKEN_RULES),
]

/** Where the check's context is held to. */
type Held = { options?: ToolOptions; exclude?: readonly string[]; only?: readonly number[] }

/**
 * Runs the readability check over a text with the tokens of `lexicon` and
 * returns what it found of one rule, in position order. Without a lexicon the
 * check has no tokens, as when the engine is missing.
 */
export function readTokens(
  rule: string,
  text: string,
  lexicon: readonly string[] | undefined,
  { options = {}, exclude, only }: Held = {},
): Hit[] {
  const doc = readDocument(text)
  const tokens = lexicon === undefined ? new Map() : tokensOf(doc, lexicon, only)
  const given: Given = exclude === undefined ? {} : { exclude_rules: [...exclude] }
  return readabilityCheck
    .run(
      checkContext({
        doc,
        conventions: resolveConventions(given, options),
        enabled: selectRules(given, options, [readabilityCheck]),
        genre: DEFAULT_GENRE,
        thresholds: resolveThresholds(options, DEFAULT_GENRE),
        tokens,
      }),
    )
    .findings.filter((item) => item.rule === rule)
    .sort((a, b) => a.start - b.start)
    .map((item) => ({ text: text.slice(item.start, item.end), start: item.start, reason: item.reason }))
}
