import type { ToolOptions } from "../tool"
import { resolveThresholds } from "./checks/thresholds"
import { resolveConventions, withSettled } from "./conventions"
import { DEFAULT_LIMIT } from "./limits"
import { readMorphology, type EngineContext } from "./morphology"
import type { TextDocument } from "./model"
import { CHECK_SPECS } from "./registry"
import { buildReport } from "./report"
import { CHECKS, DEFAULT_GENRE, mergeResults, type CheckSpec } from "./rules"
import type { TextReadInput, TextReadOutput } from "./schemas"
import { selectRules } from "./selection"

/**
 * Inspects a document: resolves what each convention is held to and which
 * rules run, runs the requested checks (all of them when `checks` is left
 * out) in the order of `CHECKS`, and builds the report from what they found
 * and from the inventories of the `outline` and `terms` checks that ran.
 * When a rule that is on in a requested check needs morphology, the engine
 * reads the document's prose and list blocks once first (see `readMorphology`),
 * and the rules that could not read some or all of it are listed in `not_run`.
 * The thresholds come from the settings in `options`, else from the genre.
 * `checks` is the registry to run; tests pass their own. `engine` is where
 * the call's engine lives; without it, a rule that needs morphology is not run.
 */
export async function inspect(
  doc: TextDocument,
  args: TextReadInput,
  options: ToolOptions,
  checks: readonly CheckSpec[] = CHECK_SPECS,
  engine: EngineContext = {},
): Promise<TextReadOutput> {
  const conventions = resolveConventions(args, options)
  const enabled = selectRules(args, options, checks)
  const requested = new Set(args.checks ?? CHECKS)
  const ran = CHECKS.filter((name) => requested.has(name)).flatMap((name) =>
    checks.filter((spec) => spec.name === name),
  )
  const needTokens = ran.flatMap((spec) => spec.rules.filter((rule) => rule.morphology && enabled(rule.id)))
  const { tokens, notRun } = await readMorphology(doc, needTokens, engine)
  const genre = args.genre ?? DEFAULT_GENRE
  const thresholds = resolveThresholds(options, genre)
  const {
    findings,
    settled = {},
    outline,
    terms,
  } = mergeResults(
    ran.map((spec) => spec.run({ doc, conventions, enabled, genre, thresholds, stance: args.stance, tokens })),
  )
  return buildReport({
    doc,
    checks: ran.map((spec) => spec.name),
    genre,
    stance: args.stance,
    conventions: withSettled(conventions, settled),
    notRun,
    found: findings,
    outline,
    terms,
    specs: checks,
    limit: args.limit ?? DEFAULT_LIMIT,
  })
}
