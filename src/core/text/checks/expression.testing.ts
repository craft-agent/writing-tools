import type { ToolOptions } from "../../tool"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import type { CheckResult, RawFinding } from "../rules"
import { selectRules } from "../selection"
import { expressionCheck } from "./expression"
import type { Given } from "./notation.testing"

/** Runs the expression check over a text as `inspect` would, with the arguments and settings given. */
export function run(text: string, given: Given = {}, options: ToolOptions = {}): CheckResult {
  const doc = readDocument(text)
  const conventions = resolveConventions(given, options)
  const enabled = selectRules(given, options, [expressionCheck])
  return expressionCheck.run({ doc, conventions, enabled })
}

function inOrder(text: string, given: Given, options: ToolOptions): RawFinding[] {
  return run(text, given, options).findings.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** The rule and the matched text of each finding of the expression check, in position order. */
export function hits(text: string, given: Given = {}, options: ToolOptions = {}): [string, string][] {
  return inOrder(text, given, options).map((item) => [item.rule, text.slice(item.start, item.end)])
}

/** The reasons of the findings of the expression check, in position order. */
export function reasons(text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return inOrder(text, given, options).map((item) => item.reason)
}
