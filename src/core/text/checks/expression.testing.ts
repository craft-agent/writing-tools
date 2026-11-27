import type { ToolOptions } from "../../tool"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import { DEFAULT_GENRE, type CheckResult, type RawFinding } from "../rules"
import { checkContext } from "../rules.testing"
import { selectRules } from "../selection"
import { expressionCheck } from "./expression"
import type { Given } from "./notation.testing"

/** Runs the expression check over a text as `inspect` would, with the arguments and settings given. */
export function run(text: string, given: Given = {}, options: ToolOptions = {}): CheckResult {
  const doc = readDocument(text)
  const conventions = resolveConventions(given, options)
  const enabled = selectRules(given, options, [expressionCheck])
  return expressionCheck.run(
    checkContext({ doc, conventions, enabled, genre: given.genre ?? DEFAULT_GENRE, stance: given.stance }),
  )
}

function inOrder(text: string, given: Given, options: ToolOptions): RawFinding[] {
  return run(text, given, options).findings.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** The rule and the matched text of each finding of the expression check, in position order. */
export function hits(text: string, given: Given = {}, options: ToolOptions = {}): [string, string][] {
  return inOrder(text, given, options).map((item) => [item.rule, text.slice(item.start, item.end)])
}

/** The matched text of each finding of one rule of the expression check, in position order. */
export function matched(rule: string, text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return hits(text, given, options)
    .filter(([id]) => id === rule)
    .map(([, found]) => found)
}

/** The reasons of the findings of one rule of the expression check, in position order. */
export function reasonsOf(rule: string, text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return inOrder(text, given, options)
    .filter((item) => item.rule === rule)
    .map((item) => item.reason)
}

/** The reasons of the findings of the expression check, in position order. */
export function reasons(text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return inOrder(text, given, options).map((item) => item.reason)
}
