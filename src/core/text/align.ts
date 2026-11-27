import { commonPairs, type IndexPair } from "./lcs"
import { likePairs } from "./likeness"
import { MASK_CHAR, type LineKind, type TextDocument } from "./model"

/** The kinds of block whose sentences are aligned; a quotation is someone else's text, and a table row has no sentence. */
const ALIGNED_KINDS: ReadonlySet<LineKind> = new Set(["prose", "list", "heading"])

/** How a pair of sentences stands: the same in both texts, or alike but changed. */
export type PairKind = "unchanged" | "changed"

/** The text of a comparison a sentence or an offset belongs to. */
export type Side = "original" | "revision"

/** How the sentence at an offset stands: its pair's kind, or `unpaired` when the other text has no sentence for it. */
export type Status = PairKind | "unpaired"

/** One sentence of the original and the one of the revision it pairs with, as indexes into each document's `sentences`. */
export type SentencePair = { original: number; revision: number; kind: PairKind }

/** How the sentences of an original and of its revision line up. */
export type Alignment = {
  /** In the order of both texts: a pair never crosses another. */
  pairs: readonly SentencePair[]
  /** The sentences of the original that have no pair, as indexes into its `sentences`. */
  dropped: readonly number[]
  /** The sentences of the revision that have no pair, as indexes into its `sentences`. */
  added: readonly number[]
  /** How the sentence that holds `offset` stands, or `undefined` for an offset outside every aligned sentence, such as a table row. */
  statusAt(side: Side, offset: number): Status | undefined
  /**
   * Where an offset of the original stands in the revision: the start of the
   * sentence paired with the one that holds it, else of the next sentence
   * that has a pair, else the end of the revision. An offset between two
   * sentences counts with the sentence after it.
   */
  placeOf(offset: number): number
}

/** A sentence that is aligned: its place in `doc.sentences`, its offsets and its key. */
type Unit = { index: number; start: number; end: number; key: string }

/**
 * What makes two sentences the same: the text without the masked characters
 * and without any whitespace, in compatibility form. So code, URLs and the
 * like never differ, a text wrapped at another width or spaced differently
 * around Latin words still pairs, and widths of letters, digits and kana do
 * not make a sentence changed.
 */
function keyOf(doc: TextDocument, start: number, end: number): string {
  return doc.masked.slice(start, end).replaceAll(MASK_CHAR, "").replace(/\s+/g, "").normalize("NFKC")
}

function unitsOf(doc: TextDocument): Unit[] {
  return doc.sentences.flatMap((sentence, index) =>
    ALIGNED_KINDS.has(sentence.kind)
      ? [{ index, start: sentence.start, end: sentence.end, key: keyOf(doc, sentence.start, sentence.end) }]
      : [],
  )
}

/** The index of the first unit for which `holds` is true; the units' count when none. `holds` must be false and then true along the units. */
function firstWhere(units: readonly Unit[], holds: (unit: Unit) => boolean): number {
  let low = 0
  let high = units.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (holds(units[middle])) high = middle
    else low = middle + 1
  }
  return low
}

/** A pair of units: their places among the aligned units of each text, not in `sentences`. */
type UnitPair = { original: number; revision: number; kind: PairKind }

/** Pairs the units of both texts: the ones with the same key in order, then the changed ones between them by how alike they are. */
function pairUnits(original: readonly Unit[], revision: readonly Unit[]): UnitPair[] {
  const exact = commonPairs(
    original.map(({ key }) => key),
    revision.map(({ key }) => key),
  )
  const ends: IndexPair[] = [...exact, [original.length, revision.length]]
  const pairs: UnitPair[] = []
  let fromOriginal = 0
  let fromRevision = 0
  for (const [at, other] of ends) {
    const alike = likePairs(
      original.slice(fromOriginal, at).map(({ key }) => key),
      revision.slice(fromRevision, other).map(({ key }) => key),
    )
    for (const [first, second] of alike) {
      pairs.push({ original: fromOriginal + first, revision: fromRevision + second, kind: "changed" })
    }
    if (at < original.length) pairs.push({ original: at, revision: other, kind: "unchanged" })
    fromOriginal = at + 1
    fromRevision = other + 1
  }
  return pairs
}

/**
 * Aligns the sentences of two documents: the sentences of prose, list items
 * and headings, quotations and table rows left out. A sentence found
 * unchanged in both texts (see {@link keyOf}) pairs with itself, in order,
 * by a longest common subsequence. The changed sentences between two such
 * pairs pair by their likeness (see {@link likePairs}), best first and
 * without crossing. A sentence left over was dropped from the original or
 * added to the revision, and one that only moved is both, so it pairs with
 * nothing. The sentences of both documents are read as the document split
 * them; nothing is kept.
 */
export function alignSentences(original: TextDocument, revision: TextDocument): Alignment {
  const first = unitsOf(original)
  const second = unitsOf(revision)
  const paired = pairUnits(first, second)
  const statuses: Record<Side, Status[]> = {
    original: first.map((): Status => "unpaired"),
    revision: second.map((): Status => "unpaired"),
  }
  for (const { original: at, revision: other, kind } of paired) {
    statuses.original[at] = kind
    statuses.revision[other] = kind
  }
  const pairedRevision = new Map(paired.map(({ original: at, revision: other }) => [at, other]))
  const placeOfUnit = new Array<number>(first.length)
  for (let at = first.length - 1, place = revision.text.length; at >= 0; at--) {
    const other = pairedRevision.get(at)
    if (other !== undefined) place = second[other].start
    placeOfUnit[at] = place
  }
  const units: Record<Side, readonly Unit[]> = { original: first, revision: second }
  return {
    pairs: paired.map(({ original: at, revision: other, kind }) => ({
      original: first[at].index,
      revision: second[other].index,
      kind,
    })),
    dropped: first.flatMap((unit, at) => (statuses.original[at] === "unpaired" ? [unit.index] : [])),
    added: second.flatMap((unit, at) => (statuses.revision[at] === "unpaired" ? [unit.index] : [])),
    statusAt(side, offset) {
      const holding = firstWhere(units[side], (unit) => unit.end > offset)
      const unit = units[side][holding]
      return unit !== undefined && unit.start <= offset ? statuses[side][holding] : undefined
    },
    placeOf(offset) {
      const at = firstWhere(first, (unit) => unit.end > offset)
      return at < first.length ? placeOfUnit[at] : revision.text.length
    },
  }
}
