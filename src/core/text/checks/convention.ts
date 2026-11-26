import type { ConventionName, ResolvedConvention } from "../conventions"
import type { CheckContext, CheckResult, RawFinding } from "../rules"

/** One use of a convention's value in the text: offsets into `doc.text`, `end` exclusive. */
export type Occurrence = { value: string; start: number; end: number }

/** The occurrence of `value` that a match of a line makes, `start` being where the line's view starts in the text. */
export function occurrenceOf(value: string, start: number, match: RegExpExecArray): Occurrence {
  const at = start + match.index
  return { value, start: at, end: at + match[0].length }
}

/** How often a value occurs. */
type Count = { value: string; count: number }

/** What the majority of a text's occurrences settled: the value, if any occurs, and a finding for every other one. */
type Majority = { findings: RawFinding[]; value: string | undefined }

function finding(rule: string, occurrence: Occurrence, reason: string): RawFinding {
  return { rule, start: occurrence.start, end: occurrence.end, reason }
}

/** The values of the occurrences with their counts, the most common first; on a tie, the value that occurs first. */
function tally(occurrences: readonly Occurrence[]): Count[] {
  const byValue = new Map<string, Count & { first: number }>()
  for (const { value, start } of occurrences) {
    const seen = byValue.get(value)
    if (seen === undefined) byValue.set(value, { value, count: 1, first: start })
    else {
      seen.count++
      seen.first = Math.min(seen.first, start)
    }
  }
  return [...byValue.values()].sort((a, b) => b.count - a.count || a.first - b.first)
}

/**
 * Holds the occurrences to the value most of them have. A text with fewer than
 * two values draws no finding; with two or more, every occurrence of a value
 * other than the most common is a finding of `rule` that names the majority
 * and the counts. `show` writes a value into a reason.
 */
export function holdToMajority(
  rule: string,
  occurrences: readonly Occurrence[],
  show: (value: string) => string = (value) => value,
): Majority {
  const counts = tally(occurrences)
  if (counts.length < 2) return { findings: [], value: counts[0]?.value }
  const [top] = counts
  const countOf = new Map(counts.map(({ value, count }) => [value, count]))
  const findings = occurrences
    .filter(({ value }) => value !== top.value)
    .map((occurrence) =>
      finding(
        rule,
        occurrence,
        `${show(occurrence.value)} here; the text mostly uses ${show(top.value)} (${top.count} to ${countOf.get(occurrence.value)})`,
      ),
    )
  return { findings, value: top.value }
}

/** Where an expected value came from, as a reason names it. */
export function originOf(held: ResolvedConvention): string {
  return held.source === "argument" ? "the argument" : "the setting"
}

/**
 * Judges one convention's occurrences. Held to a value by the argument or the
 * setting, each occurrence of another value is a finding of the rule named
 * after the convention. Held to nothing, the text is held to its own
 * majority (see {@link holdToMajority}), and the value it settled on goes
 * back as `settled` whenever the text uses the convention at all.
 */
export function judgeConvention(
  ctx: CheckContext,
  name: ConventionName,
  occurrences: readonly Occurrence[],
): CheckResult {
  const held = ctx.conventions[name]
  if (held.value !== null) {
    const origin = originOf(held)
    return {
      findings: occurrences
        .filter(({ value }) => value !== held.value)
        .map((occurrence) =>
          finding(name, occurrence, `uses ${occurrence.value} where ${origin} expects ${held.value}`),
        ),
    }
  }
  const { findings, value } = holdToMajority(name, occurrences)
  return { findings, ...(value === undefined ? {} : { settled: { [name]: value } }) }
}
