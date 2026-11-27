import type { ToolOptions } from "../../tool"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import { DEFAULT_GENRE, type RawFinding } from "../rules"
import { checkContext } from "../rules.testing"
import { selectRules } from "../selection"
import type { Given } from "./notation.testing"
import { readabilityCheck } from "./readability"
import { resolveThresholds } from "./thresholds"

function inOrder(text: string, given: Given, options: ToolOptions): RawFinding[] {
  const doc = readDocument(text)
  const genre = given.genre ?? DEFAULT_GENRE
  const context = checkContext({
    doc,
    conventions: resolveConventions(given, options),
    enabled: selectRules(given, options, [readabilityCheck]),
    genre,
    thresholds: resolveThresholds(options, genre),
  })
  return readabilityCheck.run(context).findings.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** The rule and the matched text of each finding of the readability check, in position order. */
export function hits(text: string, given: Given = {}, options: ToolOptions = {}): [string, string][] {
  return inOrder(text, given, options).map((item) => [item.rule, text.slice(item.start, item.end)])
}

/** The matched text of each finding of one rule of the readability check, in position order. */
export function matched(rule: string, text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return hits(text, given, options)
    .filter(([id]) => id === rule)
    .map(([, found]) => found)
}

/** The reasons of the findings of one rule of the readability check, in position order. */
export function reasonsOf(rule: string, text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return inOrder(text, given, options)
    .filter((item) => item.rule === rule)
    .map((item) => item.reason)
}
