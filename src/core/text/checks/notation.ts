import type { ConventionName } from "../conventions"
import type { CheckContext, CheckResult, CheckSpec, RawFinding, RuleSpec } from "../rules"
import { mergeResults } from "../rules"
import { judgeConvention, type Occurrence } from "./convention"
import { readableLines, type LineView } from "./lines"
import { findPunctuation, judgePunctuation } from "./punctuation"
import {
  findLatinSpacing,
  findSpaceAroundPunctuation,
  findSpaceBetweenJapanese,
  findSpaceInsideBrackets,
  findUnitSpacing,
} from "./spacing"
import { findAlnumWidth, findBracketWidth, findHalfwidthKatakana } from "./width"

/** A rule that is on by default and needs no morphology, a `warn` explained in `notation.md` under its id. */
function warn(id: string): RuleSpec {
  return { id, check: "notation", severity: "warn", defaultOn: true, morphology: false, reference: `notation.md#${id}` }
}

/** A convention rule: where it finds the uses of the convention's values, and how they are judged. */
type ConventionRule = {
  name: ConventionName
  find(lines: readonly LineView[]): Occurrence[]
  judge?(ctx: CheckContext, occurrences: readonly Occurrence[]): CheckResult
}

const CONVENTION_RULES: readonly ConventionRule[] = [
  { name: "latin_spacing", find: findLatinSpacing },
  { name: "unit_spacing", find: findUnitSpacing },
  { name: "alnum_width", find: findAlnumWidth },
  { name: "bracket_width", find: findBracketWidth },
  { name: "punctuation", find: findPunctuation, judge: judgePunctuation },
]

/** A fault rule: where it finds the text it reports. */
type FaultRule = { id: string; find(lines: readonly LineView[]): RawFinding[] }

const FAULT_RULES: readonly FaultRule[] = [
  { id: "halfwidth_katakana", find: findHalfwidthKatakana },
  { id: "space_between_japanese", find: findSpaceBetweenJapanese },
  { id: "space_around_punctuation", find: findSpaceAroundPunctuation },
  { id: "space_inside_brackets", find: findSpaceInsideBrackets },
]

const RULES: readonly RuleSpec[] = [
  ...CONVENTION_RULES.map(({ name }) => name),
  ...FAULT_RULES.map(({ id }) => id),
].map(warn)

/**
 * Typography and spelling: spacing, widths and punctuation. It reads prose,
 * headings, list items and table rows, never a quotation or masked text. A
 * convention rule holds the text to the convention's value or to its own
 * majority, and a rule that is off is neither run nor settled.
 */
export const notationCheck: CheckSpec = {
  name: "notation",
  rules: RULES,
  run(ctx) {
    const lines = readableLines(ctx.doc)
    const conventions = CONVENTION_RULES.filter(({ name }) => ctx.enabled(name)).map(({ name, find, judge }) =>
      judge === undefined ? judgeConvention(ctx, name, find(lines)) : judge(ctx, find(lines)),
    )
    const faults = FAULT_RULES.filter(({ id }) => ctx.enabled(id)).map(({ find }) => ({ findings: find(lines) }))
    return mergeResults([...conventions, ...faults])
  },
}
