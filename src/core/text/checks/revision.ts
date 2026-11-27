import { leadOf } from "../excerpt"
import type { TextDocument } from "../model"
import type { CheckSpec, Comparison, RawFinding, RuleSpec, Severity } from "../rules"
import { numbersOf } from "./numbers"
import { termUsesOf } from "./terms"
import { unmatchedUses, type Use } from "./uses"

/** A rule on by default that needs no morphology, explained in `revision.md` under its id. */
function rule(id: string, severity: Severity): RuleSpec {
  return { id, check: "revision", severity, defaultOn: true, morphology: false, reference: `revision.md#${id}` }
}

/** What the revision compares as counts over the whole text: its two rules, the uses it counts, and how a reason names one. */
type Subject = {
  /** For a use the original has more of: critical, since the reader loses a fact. */
  lost: RuleSpec
  /** For a use the revision has more of: warn, since the reader takes it as the writer's. */
  added: RuleSpec
  usesOf(doc: TextDocument): Use[]
  /** The use as a reason quotes it: in double quotes, with how it was written when that differs from its key. */
  label(use: Use): string
}

const SUBJECTS: readonly Subject[] = [
  {
    lost: rule("number_lost", "critical"),
    added: rule("number_added", "warn"),
    usesOf: numbersOf,
    label: ({ key, form }) => (key === form ? `"${key}"` : `"${key}" (written ${leadOf(form)})`),
  },
  {
    lost: rule("name_lost", "critical"),
    added: rule("name_added", "warn"),
    usesOf: termUsesOf,
    label: ({ form }) => `"${leadOf(form)}"`,
  },
]

/**
 * The uses of one subject that the revision lost or added. A lost use is
 * placed where it would have stood in the revision, with its own place and
 * excerpt in the original; an added one stands in the revision alone.
 */
function findChanges(
  subject: Subject,
  doc: TextDocument,
  { original, alignment }: Comparison,
  enabled: (id: string) => boolean,
): RawFinding[] {
  const wantLost = enabled(subject.lost.id)
  const wantAdded = enabled(subject.added.id)
  if (!wantLost && !wantAdded) return []
  const before = subject.usesOf(original)
  const after = subject.usesOf(doc)
  const lost = wantLost
    ? unmatchedUses("original", before, after, alignment).map((use): RawFinding => {
        const place = alignment.placeOf(use.start)
        return {
          rule: subject.lost.id,
          start: place,
          end: place,
          reason: `${subject.label(use)} is in the original but not in the revision`,
          original: { start: use.start, end: use.end, excerpt: true },
        }
      })
    : []
  const added = wantAdded
    ? unmatchedUses("revision", after, before, alignment).map((use): RawFinding => ({
        rule: subject.added.id,
        start: use.start,
        end: use.end,
        reason: `${subject.label(use)} is in the revision but not in the original`,
      }))
    : []
  return [...lost, ...added]
}

/**
 * What a revision changed that may matter, found by comparing it with its
 * original: numbers and names that one text has more of than the other. Both
 * are counted over the whole text, so a sentence that only moved changes
 * nothing, and a number is its value (`1,000` and `１０００`). Without a
 * comparison, which only `compare` gives, it finds nothing.
 */
export const revisionCheck: CheckSpec = {
  name: "revision",
  rules: SUBJECTS.flatMap(({ lost, added }) => [lost, added]),
  run({ doc, enabled, comparison }) {
    if (comparison === undefined) return { findings: [] }
    return { findings: SUBJECTS.flatMap((subject) => findChanges(subject, doc, comparison, enabled)) }
  },
}
