import type { ToolOptions } from "../tool"
import { resolveConventions } from "./conventions"
import { DEFAULT_LIMIT } from "./limits"
import type { TextDocument } from "./model"
import { CHECK_SPECS } from "./registry"
import { buildReport } from "./report"
import { CHECKS, type CheckSpec, type RawFinding } from "./rules"
import type { TextReadInput, TextReadOutput } from "./schemas"
import { selectRules } from "./selection"

/**
 * Inspects a document: resolves what each convention is held to and which
 * rules run, runs the requested checks (all of them when `checks` is left
 * out) in the order of `CHECKS`, and builds the report from what they found.
 * `checks` is the registry to run; tests pass their own.
 */
export function inspect(
  doc: TextDocument,
  args: TextReadInput,
  options: ToolOptions,
  checks: readonly CheckSpec[] = CHECK_SPECS,
): TextReadOutput {
  const conventions = resolveConventions(args, options)
  const enabled = selectRules(args, options, checks)
  const requested = new Set(args.checks ?? CHECKS)
  const ran = CHECKS.filter((name) => requested.has(name)).flatMap((name) =>
    checks.filter((spec) => spec.name === name),
  )
  const found: RawFinding[] = ran.flatMap((spec) => spec.run({ doc, conventions, enabled }))
  return buildReport({
    doc,
    checks: ran.map((spec) => spec.name),
    conventions,
    notRun: [],
    found,
    specs: checks,
    limit: args.limit ?? DEFAULT_LIMIT,
  })
}
