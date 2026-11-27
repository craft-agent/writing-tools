import type { CheckContext, CheckResult } from "../rules"
import { COMMAS, DIGIT, PERIODS, SENTENCE_MARKS } from "./chars"
import { holdToMajority, originOf, type Occurrence } from "./convention"
import type { LineView } from "./lines"

/** The comma and the period each value of `punctuation` writes. */
const MARKS_OF = {
  ten_maru: ["、", "。"],
  comma_period: ["，", "．"],
  comma_maru: ["，", "。"],
} as const satisfies Record<string, readonly [string, string]>

const MARK = new RegExp(`[${SENTENCE_MARKS.join("")}]`, "g")
const IS_DIGIT = new RegExp(DIGIT)

/** The marks that also write a number's decimal point or thousands separator. */
const NUMBER_MARKS: ReadonlySet<string> = new Set(["，", "．"])

function quoted(mark: string): string {
  return `"${mark}"`
}

/** Whether the characters on both sides of `at` are digits: a mark there separates a number's groups. */
function insideNumber(text: string, at: number): boolean {
  return IS_DIGIT.test(text[at - 1] ?? "") && IS_DIGIT.test(text[at + 1] ?? "")
}

/**
 * Every comma and period, as an occurrence whose value is the mark itself. A
 * ． or ， between two digits is a decimal point or a thousands separator, not
 * punctuation.
 */
export function findPunctuation(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(MARK)]
      .filter(({ 0: mark, index }) => !(NUMBER_MARKS.has(mark) && insideNumber(text, index)))
      .map(({ 0: mark, index }) => ({ value: mark, start: start + index, end: start + index + mark.length })),
  )
}

/**
 * Judges the marks against `punctuation`. Held to a value, each mark that the
 * value does not write is a finding. Held to the document, commas and periods
 * are held to their own majority, each one apart, and a minority mark of
 * either kind is a finding. The convention is settled only when exactly one
 * value writes both majorities: a text with only 。 fits `ten_maru` and
 * `comma_maru` alike, and 、 beside ． fits no value, so those stay unset
 * while their minority marks are still reported.
 */
export function judgePunctuation(ctx: CheckContext, occurrences: readonly Occurrence[]): CheckResult {
  const held = ctx.conventions.punctuation
  if (held.value !== null) {
    const written: readonly string[] = MARKS_OF[held.value as keyof typeof MARKS_OF]
    return {
      findings: occurrences
        .filter(({ value }) => !written.includes(value))
        .map(({ value, start, end }) => ({
          rule: "punctuation",
          start,
          end,
          reason: `${quoted(value)} where ${originOf(held)} expects ${held.value} (${written.join("")})`,
        })),
    }
  }
  const commas = holdToMajority(
    "punctuation",
    occurrences.filter(({ value }) => COMMAS.includes(value)),
    quoted,
  )
  const periods = holdToMajority(
    "punctuation",
    occurrences.filter(({ value }) => PERIODS.includes(value)),
    quoted,
  )
  const fits = Object.entries(MARKS_OF).filter(
    ([, [comma, period]]) =>
      (commas.value === undefined || comma === commas.value) &&
      (periods.value === undefined || period === periods.value),
  )
  const used = commas.value !== undefined || periods.value !== undefined
  return {
    findings: [...commas.findings, ...periods.findings],
    ...(used && fits.length === 1 ? { settled: { punctuation: fits[0][0] } } : {}),
  }
}
