import type { Sentence, TextDocument } from "../model"
import type { Comparison, OriginalPlace, RawFinding, Stance } from "../rules"
import { COUNTED_KINDS, terminatedSentences, type Wording } from "./register"
import { CONFLICTS, KIND_NOUNS, STANCE_NOUNS, classifyStanceEnding, type StanceEnding } from "./stance"

/** The rule that reports an ending the revision moved against the stance. */
export const STANCE_RULE = "stance_ending_moved"

/** What a sentence ends in, and where the ending is in the text: from its start through the terminator. */
type Ending = StanceEnding & { start: number; end: number }

/** The ending of a sentence of body text or a list item that ends in a terminator, or `undefined` for one that ends in no kind of ending. */
function endingOf({ text, offsets, terminatorAt }: Wording): Ending | undefined {
  const found = classifyStanceEnding(text.slice(0, terminatorAt))
  return found === undefined ? undefined : { ...found, start: offsets[found.index], end: offsets[terminatorAt] + 1 }
}

/** The wording of each sentence of the document that ends in a terminator, by sentence. */
function wordingsOf(doc: TextDocument): Map<Sentence, Wording> {
  return new Map(terminatedSentences(doc, COUNTED_KINDS).map((wording) => [wording.sentence, wording]))
}

/** Where the original's sentence ends: its ending when it has one, else its terminator, else the end of the sentence. */
function placeOfEnding(sentence: Sentence, wording: Wording | undefined, ending: Ending | undefined): OriginalPlace {
  if (ending !== undefined) return ending
  if (wording === undefined) return { start: sentence.end, end: sentence.end }
  const terminator = wording.offsets[wording.terminatorAt]
  return { start: terminator, end: terminator + 1 }
}

/**
 * The `stance_ending_moved` findings: for each changed pair, the revision's
 * sentence ends in a kind of ending that goes against the stance and the
 * original's did not end in that kind. It stands at the revision's ending,
 * through its terminator, and in the original at that sentence's ending. An
 * unchanged pair ends as the original did, and a sentence with no pair is
 * `stance_ending`'s to report in `inspect`, so neither is read. Unlike
 * `stance_ending`, the last sentence of an explanation is not spared: that the
 * revision moved it is what is reported.
 */
export function findStanceMoves(doc: TextDocument, { original, alignment }: Comparison, stance: Stance): RawFinding[] {
  const before = wordingsOf(original)
  const after = wordingsOf(doc)
  return alignment.pairs.flatMap(({ original: was, revision: now, kind }): RawFinding[] => {
    if (kind !== "changed") return []
    const wording = after.get(doc.sentences[now])
    const ending = wording === undefined ? undefined : endingOf(wording)
    if (ending === undefined || !CONFLICTS[stance].includes(ending.kind)) return []
    const sentence = original.sentences[was]
    const earlier = before.get(sentence)
    const earlierEnding = earlier === undefined ? undefined : endingOf(earlier)
    if (earlierEnding?.kind === ending.kind) return []
    return [
      {
        rule: STANCE_RULE,
        start: ending.start,
        end: ending.end,
        reason: `${KIND_NOUNS[ending.kind]} in ${STANCE_NOUNS[stance]}: the sentence now ends in "${ending.ending}"; the original's ending was not ${KIND_NOUNS[ending.kind]}`,
        original: placeOfEnding(sentence, earlier, earlierEnding),
      },
    ]
  })
}
