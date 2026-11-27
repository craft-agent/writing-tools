import type { ToolOptions } from "../../tool"
import { resolveConventions, type ConventionArguments } from "../conventions"
import { readDocument } from "../document"
import type { CheckResult } from "../rules"
import { checkContext } from "../rules.testing"
import { selectRules, type RuleArguments } from "../selection"
import type { Occurrence } from "./convention"
import { readableLines, type LineView } from "./lines"
import { notationCheck } from "./notation"

/** What a test gives the notation check besides the text: convention and rule arguments. */
export type Given = ConventionArguments & RuleArguments

type Span = { start: number; end: number }

function inOrder(a: Span, b: Span): number {
  return a.start - b.start || a.end - b.end
}

/** Runs the notation check over a text as `inspect` would, with the arguments and settings given. */
export function run(text: string, given: Given = {}, options: ToolOptions = {}): CheckResult {
  const doc = readDocument(text)
  const conventions = resolveConventions(given, options)
  const enabled = selectRules(given, options, [notationCheck])
  return notationCheck.run(checkContext({ doc, conventions, enabled }))
}

/** The rule and the matched text of each finding of the notation check, in position order. */
export function hits(text: string, given: Given = {}, options: ToolOptions = {}): [string, string][] {
  return run(text, given, options)
    .findings.sort(inOrder)
    .map((item) => [item.rule, text.slice(item.start, item.end)])
}

/** The reasons of the findings of the notation check, in position order. */
export function reasons(text: string, given: Given = {}, options: ToolOptions = {}): string[] {
  return run(text, given, options)
    .findings.sort(inOrder)
    .map((item) => item.reason)
}

/** The value and the matched text of each occurrence a finder reports for a text, in position order. */
export function seen(find: (lines: readonly LineView[]) => Occurrence[], text: string): [string, string][] {
  return find(readableLines(readDocument(text)))
    .sort(inOrder)
    .map((item) => [item.value, text.slice(item.start, item.end)])
}
