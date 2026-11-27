import { leadOf } from "../excerpt"
import type { TextDocument } from "../model"
import type { CheckSpec, Comparison, RawFinding, RuleSpec, Severity } from "../rules"
import { MARKER_KINDS } from "./markers"
import { numbersOf } from "./numbers"
import { findLeadChanges, LEAD_RULE } from "./revision.leads"
import { findMarkerChanges } from "./revision.markers"
import { findStanceMoves, STANCE_RULE } from "./revision.stance"
import { CONTENT_ADDED_RULE, CONTENT_LOST_RULE, contentUsesOf, isWhollyRead } from "./revision.words"
import { termUsesOf } from "./terms"
import type { BlockTokens } from "./tokenized"
import { labelOf, unmatchedUses, type Use } from "./uses"

/** A rule on by default, explained in `revision.md` under its id; `extra` sets what it says besides. */
function rule(
  id: string,
  severity: Severity,
  extra: Partial<Pick<RuleSpec, "needsStance" | "morphology">> = {},
): RuleSpec {
  return {
    id,
    check: "revision",
    severity,
    defaultOn: true,
    morphology: false,
    reference: `revision.md#${id}`,
    ...extra,
  }
}

/** What the revision compares as counts over the whole text: its two rules, the uses it counts, and how a reason names one. */
type Subject = {
  /** For a use the original has more of: critical for a fact the reader loses, info for a word. */
  lost: RuleSpec
  /** For a use the revision has more of: warn for what the reader takes as the writer's, info for a word. */
  added: RuleSpec
  usesOf(doc: TextDocument, tokens: BlockTokens): Use[]
  /** The use as a reason quotes it. */
  label(use: Use): string
  /** Reported once for each key, with how many uses of it differ, instead of once for each use. */
  perKey?: true
}

const SUBJECTS: readonly Subject[] = [
  {
    lost: rule("number_lost", "critical"),
    added: rule("number_added", "warn"),
    usesOf: numbersOf,
    label: labelOf,
  },
  {
    lost: rule("name_lost", "critical"),
    added: rule("name_added", "warn"),
    usesOf: termUsesOf,
    label: ({ form }) => `"${leadOf(form)}"`,
  },
  {
    lost: rule(CONTENT_LOST_RULE, "info", { morphology: true }),
    added: rule(CONTENT_ADDED_RULE, "info", { morphology: true }),
    usesOf: contentUsesOf,
    label: labelOf,
    perKey: true,
  },
]

/** A use that stands for `count` uses of its key. */
type Counted = { use: Use; count: number }

/** The uses as they are reported: each one, or, `perKey`, the first use of each key with how many there are of it. `uses` are in order of position. */
function countedUses(uses: readonly Use[], perKey: boolean): Counted[] {
  if (!perKey) return uses.map((use) => ({ use, count: 1 }))
  const byKey = new Map<string, Counted>()
  for (const use of uses) {
    const seen = byKey.get(use.key)
    if (seen === undefined) byKey.set(use.key, { use, count: 1 })
    else seen.count++
  }
  return [...byKey.values()]
}

/** What a reason says of a use that stands for several: how many. */
function countNote(count: number): string {
  return count > 1 ? ` (${count} uses)` : ""
}

/**
 * The uses of one subject that the revision lost or added. A lost use is
 * placed where it would have stood in the revision, with its own place and
 * excerpt in the original; an added one stands in the revision alone.
 */
function findChanges(
  subject: Subject,
  doc: TextDocument,
  tokens: BlockTokens,
  { original, alignment, originalTokens }: Comparison,
  enabled: (id: string) => boolean,
): RawFinding[] {
  const wantLost = enabled(subject.lost.id)
  const wantAdded = enabled(subject.added.id)
  if (!wantLost && !wantAdded) return []
  const perKey = subject.perKey === true
  const before = subject.usesOf(original, originalTokens)
  const after = subject.usesOf(doc, tokens)
  const lost = wantLost
    ? countedUses(unmatchedUses("original", before, after, alignment), perKey).map(({ use, count }): RawFinding => {
        const place = alignment.placeOf(use.start)
        return {
          rule: subject.lost.id,
          start: place,
          end: place,
          reason: `${subject.label(use)} is in the original but not in the revision${countNote(count)}`,
          original: { start: use.start, end: use.end, excerpt: true },
        }
      })
    : []
  const added = wantAdded
    ? countedUses(unmatchedUses("revision", after, before, alignment), perKey).map(({ use, count }): RawFinding => ({
        rule: subject.added.id,
        start: use.start,
        end: use.end,
        reason: `${subject.label(use)} is in the revision but not in the original${countNote(count)}`,
      }))
    : []
  return [...lost, ...added]
}

/** The rules that compare the sentences of a pair: a marker kind's, a lead's and an ending's. */
const SENTENCE_RULES: readonly RuleSpec[] = [
  ...MARKER_KINDS.map(({ rule: id }) => rule(id, "warn")),
  rule(LEAD_RULE, "info"),
  rule(STANCE_RULE, "warn", { needsStance: true }),
]

/**
 * What a revision changed that may matter, found by comparing it with its
 * original. Numbers and names that one text has more of than the other are
 * counted over the whole text, so a sentence that only moved changes nothing,
 * and a number is its value (`1,000` and `１０００`). Obligation, conjecture
 * and emphasis markers, the leading connective or demonstrative, and the
 * ending against the stance are compared sentence by sentence, within the
 * pairs the alignment made. Content words, which need the engine's tokens of
 * both texts, are counted the same way, once for each word; they are compared
 * only when the engine read every block of prose and list items of both
 * texts, since a count over part of a text would call the rest a change.
 * Without a comparison, which only `compare` gives, it finds nothing.
 */
export const revisionCheck: CheckSpec = {
  name: "revision",
  rules: [...SUBJECTS.flatMap(({ lost, added }) => [lost, added]), ...SENTENCE_RULES],
  run({ doc, enabled, stance, tokens, comparison }) {
    if (comparison === undefined) return { findings: [] }
    const read = isWhollyRead(doc, tokens) && isWhollyRead(comparison.original, comparison.originalTokens)
    return {
      findings: [
        ...SUBJECTS.filter(({ lost }) => read || !lost.morphology).flatMap((subject) =>
          findChanges(subject, doc, tokens, comparison, enabled),
        ),
        ...findMarkerChanges(doc, comparison, enabled),
        ...(enabled(LEAD_RULE) ? findLeadChanges(doc, comparison) : []),
        ...(stance !== undefined && enabled(STANCE_RULE) ? findStanceMoves(doc, comparison, stance) : []),
      ],
    }
  },
}
