import { Buffer } from "node:buffer"
import { locate } from "./document"
import type { ResolvedConventions } from "./conventions"
import { excerptOf } from "./excerpt"
import { MAX_RESULT_BYTES } from "./limits"
import type { TextDocument } from "./model"
import {
  CHECKS,
  SEVERITIES,
  type CheckName,
  type CheckSpec,
  type Genre,
  type RawFinding,
  type RuleSpec,
  type Severity,
  type Stance,
} from "./rules"
import {
  REPORT_VERSION,
  UNTRUSTED_NOTE,
  type Finding,
  type NotRun,
  type SeverityCounts,
  type TextReadOutput,
} from "./schemas"

/** What a report is built from. */
export type ReportInput = {
  doc: TextDocument
  /** The checks that ran. */
  checks: readonly CheckName[]
  /** The genre the call was held to, resolved. */
  genre: Genre
  /** The stance the call was held to; `undefined` when it gave none. */
  stance: Stance | undefined
  conventions: ResolvedConventions
  /** Never cut: the result's byte budget counts it, and the caller bounds its size. */
  notRun: readonly NotRun[]
  /** What the checks found, in any order. */
  found: readonly RawFinding[]
  /** The checks whose rules the findings name. */
  specs: readonly CheckSpec[]
  /** The most findings to return. */
  limit: number
}

/** A finding with its rule and the place it holds in position order. */
type Candidate = { raw: RawFinding; rule: RuleSpec; severity: Severity; order: number }

function bytesOf(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8")
}

function rankOf(severity: Severity): number {
  return SEVERITIES.indexOf(severity)
}

function inPositionOrder(a: RawFinding, b: RawFinding): number {
  if (a.start !== b.start) return a.start - b.start
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1
  return a.end - b.end
}

function emptyCounts(): SeverityCounts {
  return { critical: 0, warn: 0, info: 0 }
}

function candidatesOf(found: readonly RawFinding[], specs: readonly CheckSpec[]): Candidate[] {
  const rules = new Map(specs.flatMap((spec) => spec.rules.map((rule): [string, RuleSpec] => [rule.id, rule])))
  return [...found].sort(inPositionOrder).map((raw, order) => {
    const rule = rules.get(raw.rule)
    if (rule === undefined) throw new Error(`A check reported the rule "${raw.rule}", which no check defines.`)
    return { raw, rule, severity: raw.severity ?? rule.severity, order }
  })
}

function countsOf(candidates: readonly Candidate[]): TextReadOutput["counts"] {
  const byCheck = Object.fromEntries(CHECKS.map((name) => [name, emptyCounts()])) as Record<CheckName, SeverityCounts>
  const bySeverity = emptyCounts()
  for (const { rule, severity } of candidates) {
    byCheck[rule.check][severity]++
    bySeverity[severity]++
  }
  return { total: candidates.length, by_check: byCheck, by_severity: bySeverity }
}

/** The `limit` candidates that matter most, so a limit never hides a critical finding behind infos, in position order. */
function withinLimit(candidates: readonly Candidate[], limit: number): Candidate[] {
  const byImportance = [...candidates].sort((a, b) => rankOf(a.severity) - rankOf(b.severity) || a.order - b.order)
  return byImportance.slice(0, limit).sort((a, b) => a.order - b.order)
}

function findingOf(doc: TextDocument, { raw, rule, severity }: Candidate): Finding {
  const { line, column } = locate(doc, raw.start)
  return {
    check: rule.check,
    rule: rule.id,
    severity,
    line,
    column,
    excerpt: excerptOf(doc.text, raw.start, raw.end),
    reason: raw.reason,
    reference: rule.reference,
  }
}

/**
 * Drops findings, lowest severity and latest position first, until the whole
 * result fits the byte budget. `shellBytes` is the result's JSON with no
 * findings and no `cut`; each finding's own JSON size is added, plus the commas
 * between them and the `cut` they cause, so no drop serializes the result again.
 */
function fitBudget(shellBytes: number, kept: readonly Candidate[], sizes: readonly number[], total: number): number[] {
  const dropOrder = kept
    .map((candidate, index) => ({ index, rank: rankOf(candidate.severity) }))
    .sort((a, b) => b.rank - a.rank || b.index - a.index)
  let remaining = kept.length
  let findingsBytes = sizes.reduce((sum, size) => sum + size, 0)
  const resultBytes = () => {
    const commas = Math.max(remaining - 1, 0)
    const cutBytes =
      remaining < total ? Buffer.byteLength(`,"cut":${JSON.stringify({ findings: total - remaining })}`) : 0
    return shellBytes + findingsBytes + commas + cutBytes
  }
  const dropped = new Set<number>()
  for (const { index } of dropOrder) {
    if (resultBytes() <= MAX_RESULT_BYTES) break
    dropped.add(index)
    findingsBytes -= sizes[index]
    remaining--
  }
  return kept.flatMap((_, index) => (dropped.has(index) ? [] : [index]))
}

/**
 * Builds the result from what the checks found: every finding is located and
 * given an excerpt, and the counts cover all of them. `limit` then keeps the
 * most severe findings, which are presented in position order, and the byte
 * budget of {@link MAX_RESULT_BYTES} cuts further from the lowest severity up.
 * `cut` is present only when findings were left out, and counts them all.
 */
export function buildReport(input: ReportInput): TextReadOutput {
  const candidates = candidatesOf(input.found, input.specs)
  const kept = withinLimit(candidates, input.limit)
  const findings = kept.map((candidate) => findingOf(input.doc, candidate))
  const shell: TextReadOutput = {
    report_version: REPORT_VERSION,
    method: "inspect",
    checks: [...input.checks],
    genre: input.genre,
    stance: input.stance ?? null,
    note: UNTRUSTED_NOTE,
    not_run: [...input.notRun],
    conventions: input.conventions,
    findings: [],
    counts: countsOf(candidates),
  }
  const fitted = fitBudget(bytesOf(shell), kept, findings.map(bytesOf), candidates.length).map(
    (index) => findings[index],
  )
  const cut = candidates.length - fitted.length
  return { ...shell, findings: fitted, ...(cut > 0 ? { cut: { findings: cut } } : {}) }
}
