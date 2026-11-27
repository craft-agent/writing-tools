import type { TextDocument } from "../model"
import type { Comparison, RawFinding } from "../rules"
import { MARKER_KINDS, markersOf, type Marker, type MarkerKind } from "./markers"

/** What a sentence of the original and the sentence of the revision it is held against are, as indexes into each `sentences`; one side is absent for a sentence with no pair. */
type Counterparts = { before?: number; after?: number }

/** The markers of `own` that `other` has fewer of: as many as its count is higher, the ones `other` does not hold in the same wording first, the later one among equals. */
function excessOf(own: readonly Marker[], other: readonly Marker[]): Marker[] {
  const excess = own.length - other.length
  if (excess <= 0) return []
  const held = new Map<string, number>()
  for (const { surface } of other) held.set(surface, (held.get(surface) ?? 0) + 1)
  const unmatched = own.filter(({ surface }) => {
    const left = held.get(surface) ?? 0
    if (left > 0) held.set(surface, left - 1)
    return left === 0
  })
  return unmatched.slice(-excess)
}

/** The markers in the sentence at `index` of `doc`; none for no sentence. */
function markersIn(doc: TextDocument, index: number | undefined): Marker[] {
  if (index === undefined) return []
  const { start, end } = doc.sentences[index]
  return markersOf(doc, start, end)
}

function ofKind(markers: readonly Marker[], kind: MarkerKind): Marker[] {
  return markers.filter((marker) => marker.kind === kind)
}

/** The sentences to compare: each changed pair, each sentence with no pair that did not just move. */
function counterpartsOf({ alignment }: Comparison): Counterparts[] {
  const movedFrom = new Set(alignment.moved.map(({ original }) => original))
  const movedTo = new Set(alignment.moved.map(({ revision }) => revision))
  return [
    ...alignment.pairs.flatMap(({ original, revision, kind }) =>
      kind === "changed" ? [{ before: original, after: revision }] : [],
    ),
    ...alignment.dropped.filter((index) => !movedFrom.has(index)).map((before) => ({ before })),
    ...alignment.added.filter((index) => !movedTo.has(index)).map((after) => ({ after })),
  ]
}

/**
 * The `obligation_changed`, `conjecture_changed` and `emphasis_changed`
 * findings. The markers of each kind are counted in a sentence of the
 * original and in the sentence of the revision it pairs with, for a changed
 * pair only (an unchanged one holds the same markers); a kind the revision has
 * fewer of is dropped, one it has more of added, one finding for each marker.
 * A sentence with no pair counts against nothing, so every marker of a dropped
 * sentence is dropped and of an added one added, unless the sentence only
 * moved, which changes nothing. A dropped marker is placed where it would have
 * stood in the revision, with its own place and excerpt in the original; an
 * added one stands in the revision alone.
 */
export function findMarkerChanges(
  doc: TextDocument,
  comparison: Comparison,
  enabled: (rule: string) => boolean,
): RawFinding[] {
  const { original, alignment } = comparison
  const on = MARKER_KINDS.filter(({ rule }) => enabled(rule))
  if (on.length === 0) return []
  return counterpartsOf(comparison).flatMap(({ before, after }) => {
    const wasAll = markersIn(original, before)
    const nowAll = markersIn(doc, after)
    return on.flatMap(({ kind, rule }) => {
      const was = ofKind(wasAll, kind)
      const now = ofKind(nowAll, kind)
      const dropped = excessOf(was, now).map((marker): RawFinding => {
        const place = alignment.placeOf(marker.start)
        return {
          rule,
          start: place,
          end: place,
          reason: `"${marker.surface}" (${kind}) was dropped from this sentence`,
          original: { start: marker.start, end: marker.end, excerpt: true },
        }
      })
      const added = excessOf(now, was).map((marker): RawFinding => ({
        rule,
        start: marker.start,
        end: marker.end,
        reason: `"${marker.surface}" (${kind}) was added to this sentence`,
      }))
      return [...dropped, ...added]
    })
  })
}
