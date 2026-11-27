import { Buffer } from "node:buffer"
import { locate } from "./document"
import type { ResolvedConventions } from "./conventions"
import { excerptOf } from "./excerpt"
import { MAX_OUTLINE_ENTRIES, MAX_RESULT_BYTES, MAX_TERMS } from "./limits"
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
  type Cut,
  type Finding,
  type NotRun,
  type Outline,
  type SeverityCounts,
  type Term,
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
  /** The inventory of the `outline` check, when it ran: its headings are capped, and cut by the byte budget. */
  outline?: Outline
  /** Every term of the `terms` check, in order of first use, when it ran: the most used are kept, and the byte budget cuts further. */
  terms?: readonly Term[]
}

/** A finding with its rule and the place it holds in position order. */
type Candidate = { raw: RawFinding; rule: RuleSpec; severity: Severity; order: number }

/** The lists of a result that the byte budget cuts from, in the order it cuts them: the lowest findings, then outline headings, then the least used terms. */
const POOL_NAMES = ["findings", "outline", "terms"] as const

type PoolName = (typeof POOL_NAMES)[number]

/** One list of the result as the byte budget sees it. */
type Pool = {
  /** The JSON bytes of each entry the list holds before the budget cuts. */
  sizes: readonly number[]
  /** The indexes of those entries, in the order the budget drops them. */
  dropOrder: readonly number[]
  /** How many entries the list had before anything cut it. */
  total: number
}

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

/** The most used `MAX_TERMS` terms, the first used winning a tie, in order of first use. */
function mostUsed(terms: readonly Term[]): Term[] {
  const ranked = terms
    .map((term, index) => ({ term, index }))
    .sort((a, b) => b.term.count - a.term.count || a.index - b.index)
  return ranked
    .slice(0, MAX_TERMS)
    .sort((a, b) => a.index - b.index)
    .map(({ term }) => term)
}

/** The `cut` of a result: each list that lost entries, with how many, in the order of {@link POOL_NAMES}; `undefined` when none did. */
function cutOf(left: Readonly<Record<PoolName, number>>): Cut | undefined {
  const lost = POOL_NAMES.flatMap((name) => (left[name] > 0 ? [[name, left[name]] as const] : []))
  return lost.length > 0 ? Object.fromEntries(lost) : undefined
}

/**
 * Drops entries until the whole result fits the byte budget: findings from the
 * lowest severity and latest position, then outline headings from the end, then
 * the terms used least, each list in the order of its pool. `shellBytes` is the
 * result's JSON with every list empty and no `cut`; each entry's own JSON size
 * is added, plus the commas between entries and the `cut` they cause, so no
 * drop serializes the result again. Returns the indexes each pool keeps.
 */
function fitBudget(shellBytes: number, pools: Readonly<Record<PoolName, Pool>>): Record<PoolName, number[]> {
  const perPool = <T>(make: (pool: Pool, name: PoolName) => T): Record<PoolName, T> =>
    Object.fromEntries(POOL_NAMES.map((name) => [name, make(pools[name], name)])) as Record<PoolName, T>
  const remaining = perPool(({ sizes }) => sizes.length)
  const bytes = perPool(({ sizes }) => sizes.reduce((sum, size) => sum + size, 0))
  const dropped = perPool(() => new Set<number>())
  const resultBytes = () => {
    const listBytes = POOL_NAMES.reduce((sum, name) => sum + bytes[name] + Math.max(remaining[name] - 1, 0), 0)
    const cut = cutOf(perPool(({ total }, name) => total - remaining[name]))
    const cutBytes = cut === undefined ? 0 : Buffer.byteLength(`,"cut":${JSON.stringify(cut)}`)
    return shellBytes + listBytes + cutBytes
  }
  const dropOrder = POOL_NAMES.flatMap((name) => pools[name].dropOrder.map((index) => ({ name, index })))
  for (const { name, index } of dropOrder) {
    if (resultBytes() <= MAX_RESULT_BYTES) break
    dropped[name].add(index)
    bytes[name] -= pools[name].sizes[index]
    remaining[name]--
  }
  return perPool(({ sizes }, name) => sizes.flatMap((_, index) => (dropped[name].has(index) ? [] : [index])))
}

/** The findings' indexes by the order the budget drops them: lowest severity first, the latest position first among equals. */
function findingDropOrder(kept: readonly Candidate[]): number[] {
  return kept
    .map((candidate, index) => ({ index, rank: rankOf(candidate.severity) }))
    .sort((a, b) => b.rank - a.rank || b.index - a.index)
    .map(({ index }) => index)
}

/** The terms' indexes by the order the budget drops them: the least used first, the latest first used among equals. */
function termDropOrder(kept: readonly Term[]): number[] {
  return kept
    .map(({ count }, index) => ({ index, count }))
    .sort((a, b) => a.count - b.count || b.index - a.index)
    .map(({ index }) => index)
}

/**
 * Builds the result from what the checks found: every finding is located and
 * given an excerpt, and the counts cover all of them. `limit` then keeps the
 * most severe findings, which are presented in position order. The outline
 * lists its first {@link MAX_OUTLINE_ENTRIES} headings and the terms the
 * {@link MAX_TERMS} most used; the byte budget of {@link MAX_RESULT_BYTES} cuts
 * further, the lowest findings first, then headings from the end, then the
 * least used terms. `cut` is present only when something was left out, and
 * each of its keys counts everything left out of that list.
 */
export function buildReport(input: ReportInput): TextReadOutput {
  const candidates = candidatesOf(input.found, input.specs)
  const kept = withinLimit(candidates, input.limit)
  const findings = kept.map((candidate) => findingOf(input.doc, candidate))
  const headings = (input.outline?.headings ?? []).slice(0, MAX_OUTLINE_ENTRIES)
  const terms = mostUsed(input.terms ?? [])
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
    ...(input.outline !== undefined ? { outline: { ...input.outline, headings: [] } } : {}),
    ...(input.terms !== undefined ? { terms: [] } : {}),
  }
  const fitted = fitBudget(bytesOf(shell), {
    findings: { sizes: findings.map(bytesOf), dropOrder: findingDropOrder(kept), total: candidates.length },
    outline: {
      sizes: headings.map(bytesOf),
      dropOrder: headings.map((_, index) => headings.length - 1 - index),
      total: input.outline?.headings.length ?? 0,
    },
    terms: { sizes: terms.map(bytesOf), dropOrder: termDropOrder(terms), total: input.terms?.length ?? 0 },
  })
  const cut = cutOf({
    findings: candidates.length - fitted.findings.length,
    outline: (input.outline?.headings.length ?? 0) - fitted.outline.length,
    terms: (input.terms?.length ?? 0) - fitted.terms.length,
  })
  return {
    ...shell,
    findings: fitted.findings.map((index) => findings[index]),
    ...(input.outline !== undefined
      ? { outline: { ...input.outline, headings: fitted.outline.map((index) => headings[index]) } }
      : {}),
    ...(input.terms !== undefined ? { terms: fitted.terms.map((index) => terms[index]) } : {}),
    ...(cut !== undefined ? { cut } : {}),
  }
}
