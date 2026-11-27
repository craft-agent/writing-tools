import type { LineKind, TextDocument } from "../model"
import type { Genre, RawFinding } from "../rules"
import { stripTrailing, terminatedSentences, type Wording } from "./register"
import { CHOPPY, ENDING_RUN, UNIFORM } from "./thresholds"

/** The kinds of block whose sentences set the rhythm: body text, since the items of a list are parallel on purpose. */
const RHYTHM_KINDS: ReadonlySet<LineKind> = new Set(["prose"])

/** The endings `ending_repetition` tells apart; the package's own list. */
const ENDINGS = ["です", "ます", "でした", "ました", "ません", "だ", "である", "だった", "た", "る"]

/** The endings longest first, so `でした` is not read as `た`. */
const LONGEST_FIRST = [...ENDINGS].sort((a, b) => b.length - a.length)

/** A connective form and the comma after it: the clause link that lets a short sentence carry on. */
const CLAUSE_LINK = /(?:て|で|し|が|けれど|ので|から|ため|ながら|ものの|ば|たら|なら|と)[、，]/

const WHITESPACE = /\s/g
const SHORT = "short"

/** The characters of a sentence without the masked units and whitespace, the terminator included. */
function compact(wording: Wording): string {
  return wording.text.replace(WHITESPACE, "")
}

/** The length of a sentence in code points, as `compact` reads it. */
function lengthOf(wording: Wording): number {
  return [...compact(wording)].length
}

/** The terminated sentences of each paragraph of body text, a sentence belonging to the block it was read in. */
function paragraphs(doc: TextDocument): Wording[][] {
  const wordings = terminatedSentences(doc, RHYTHM_KINDS)
  let next = 0
  return doc.blocks
    .filter(({ kind }) => RHYTHM_KINDS.has(kind))
    .map((block) => {
      const inside: Wording[] = []
      for (; next < wordings.length && wordings[next].sentence.start < block.end; next++) inside.push(wordings[next])
      return inside
    })
}

/** The maximal runs of consecutive items that share a key; an item without one is in no run. */
function runsBy<T>(items: readonly T[], keyOf: (item: T) => string | undefined): T[][] {
  const runs: T[][] = []
  let key: string | undefined
  for (const item of items) {
    const itemKey = keyOf(item)
    if (itemKey !== undefined && itemKey === key) runs[runs.length - 1].push(item)
    else if (itemKey !== undefined) runs.push([item])
    key = itemKey
  }
  return runs
}

/** A sentence with its wording before the terminator, without what trails it, and the ending of that, `""` when it has none of the list. */
type Ended = { wording: Wording; body: string; ending: string }

function endedOf(wording: Wording): Ended {
  const body = stripTrailing(wording.text.slice(0, wording.terminatorAt))
  return { wording, body, ending: LONGEST_FIRST.find((ending) => body.endsWith(ending)) ?? "" }
}

/**
 * The `ending_repetition` findings: in a paragraph, three or more sentences
 * in a row that end the same way, once per run, at the ending of the third and
 * naming the length of the whole run. A sentence without a terminator, or with
 * another ending, ends a run.
 */
export function findEndingRepetition(doc: TextDocument): RawFinding[] {
  return paragraphs(doc).flatMap((paragraph) =>
    runsBy(paragraph.map(endedOf), ({ ending }) => ending || undefined)
      .filter((run) => run.length >= ENDING_RUN)
      .map((run) => {
        const { wording, body, ending } = run[ENDING_RUN - 1]
        return {
          rule: "ending_repetition",
          start: wording.offsets[body.length - ending.length],
          end: wording.offsets[wording.terminatorAt] + 1,
          reason: `${run.length} sentences in a row end in "${ending}"`,
        }
      }),
  )
}

/**
 * The `choppy_sentences` findings: in a paragraph, a run of short sentences
 * (the genre's minimum or more), once per run, spanning the first of them. A
 * sentence is short when it is within the first length, or within the second
 * and has no clause link.
 */
export function findChoppySentences(doc: TextDocument, genre: Genre): RawFinding[] {
  const { short, unlinked, minRun } = CHOPPY[genre]
  const isShort = (wording: Wording): string | undefined => {
    const length = lengthOf(wording)
    return length <= short || (length <= unlinked && !CLAUSE_LINK.test(compact(wording))) ? SHORT : undefined
  }
  return paragraphs(doc).flatMap((paragraph) =>
    runsBy(paragraph, isShort)
      .filter((run) => run.length >= minRun)
      .map((run) => ({
        rule: "choppy_sentences",
        start: run[0].sentence.start,
        end: run[0].sentence.end,
        reason: `${run.length} short sentences in a row, each within ${short} characters, or ${unlinked} when no comma follows a connective`,
      })),
  )
}

/**
 * The `uniform_sentence_length` finding: the sentences of body text are all
 * about as long, by the coefficient of variation of their lengths, once there
 * are enough of them. It spans the first sentence.
 */
export function findUniformSentenceLength(doc: TextDocument, genre: Genre): RawFinding[] {
  const { minSentences, maxVariation } = UNIFORM[genre]
  const sentences = terminatedSentences(doc, RHYTHM_KINDS)
  if (sentences.length < minSentences) return []
  const lengths = sentences.map(lengthOf)
  const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length
  const variance = lengths.reduce((sum, length) => sum + (length - mean) ** 2, 0) / lengths.length
  const variation = Math.sqrt(variance) / mean
  if (variation >= maxVariation) return []
  const { start, end } = sentences[0].sentence
  return [
    {
      rule: "uniform_sentence_length",
      start,
      end,
      reason: `sentence lengths vary little: a coefficient of variation of ${variation.toFixed(2)} over ${sentences.length} sentences of ${mean.toFixed(1)} characters on average`,
    },
  ]
}
