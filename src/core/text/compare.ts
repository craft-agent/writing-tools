import type { ToolOptions } from "../tool"
import { alignSentences } from "./align"
import { resolveThresholds } from "./checks/thresholds"
import { resolveConventions } from "./conventions"
import { DEFAULT_LIMIT } from "./limits"
import type { TextDocument } from "./model"
import { CHECK_SPECS } from "./registry"
import { buildReport } from "./report"
import { DEFAULT_GENRE, mergeResults, type CheckSpec } from "./rules"
import type { TextReadInput, TextReadOutput } from "./schemas"
import { selectRules } from "./selection"

/** The one check `compare` runs. */
const REVISION_CHECK = "revision"

/**
 * Compares a revision with the text it was made from: aligns the sentences of
 * the two, resolves which rules run, runs the `revision` check over both and
 * builds the report from what it found. The rule lists are validated against
 * every check, as `inspect` validates them, and only the rules of the
 * `revision` check apply, so one `rules` setting serves both methods. No
 * convention is held to anything: `compare` reads none, and the report says
 * so. `checks` is the registry to run; tests pass their own.
 */
export async function compare(
  doc: TextDocument,
  original: TextDocument,
  args: TextReadInput,
  options: ToolOptions,
  checks: readonly CheckSpec[] = CHECK_SPECS,
): Promise<TextReadOutput> {
  const conventions = resolveConventions({})
  const enabled = selectRules(args, options, checks)
  const genre = args.genre ?? DEFAULT_GENRE
  const thresholds = resolveThresholds(options, genre)
  const comparison = { original, alignment: alignSentences(original, doc) }
  const ran = checks.filter((spec) => spec.name === REVISION_CHECK)
  const { findings } = mergeResults(
    ran.map((spec) =>
      spec.run({ doc, conventions, enabled, genre, thresholds, stance: args.stance, tokens: new Map(), comparison }),
    ),
  )
  return buildReport({
    method: "compare",
    doc,
    original,
    checks: ran.map((spec) => spec.name),
    genre,
    stance: args.stance,
    conventions,
    notRun: [],
    found: findings,
    specs: checks,
    limit: args.limit ?? DEFAULT_LIMIT,
  })
}
