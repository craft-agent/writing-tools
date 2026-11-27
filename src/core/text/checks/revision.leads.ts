import type { TextDocument } from "../model"
import type { Comparison, RawFinding } from "../rules"
import { leadOf, type Lead } from "./lead.words"

/** The rule that reports a leading connective or demonstrative that changed. */
export const LEAD_RULE = "lead_changed"

/** The lead of the sentence at `index` of `doc`. */
function leadIn(doc: TextDocument, index: number): Lead | undefined {
  const { start, end } = doc.sentences[index]
  return leadOf(doc, start, end)
}

/**
 * The `lead_changed` findings: for each changed pair, the leading connective
 * or demonstrative of the original's sentence against the revision's, one
 * finding for a lead added, dropped or changed to another. A sentence with no
 * pair is not read, and an unchanged pair has the same lead in both. The
 * finding stands at the start of the revision's sentence, and in the original
 * at its lead, or at its start when it had none; the excerpt is the original's
 * lead where one was dropped, the revision's lead otherwise.
 */
export function findLeadChanges(doc: TextDocument, { original, alignment }: Comparison): RawFinding[] {
  return alignment.pairs.flatMap(({ original: before, revision: after, kind }): RawFinding[] => {
    if (kind !== "changed") return []
    const was = leadIn(original, before)
    const now = leadIn(doc, after)
    if (was?.word === now?.word) return []
    if (now === undefined) {
      if (was === undefined) return []
      const start = doc.sentences[after].start
      return [
        {
          rule: LEAD_RULE,
          start,
          end: start,
          reason: `The leading "${was.word}" was dropped from this sentence`,
          original: { start: was.start, end: was.end, excerpt: true },
        },
      ]
    }
    const reason =
      was === undefined
        ? `A leading "${now.word}" was added to this sentence`
        : `The leading "${was.word}" was changed to "${now.word}"`
    const from = original.sentences[before].start
    return [
      {
        rule: LEAD_RULE,
        start: now.start,
        end: now.end,
        reason,
        original: was === undefined ? { start: from, end: from } : { start: was.start, end: was.end },
      },
    ]
  })
}
