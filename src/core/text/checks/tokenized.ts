import type { Token } from "../../engine/tokens"
import type { Sentence, TextDocument } from "../model"
import type { CheckContext } from "../rules"

/** The tokens the engine read, by the index of the block in `doc.blocks`. */
export type BlockTokens = CheckContext["tokens"]

/** A sentence and the tokens that start inside it. */
export type SentenceTokens = { sentence: Sentence; tokens: readonly Token[] }

/** Whitespace only: what the engine reads over a masked unit or a line break, which the segment blanked. */
const BLANK = /^\s*$/

/**
 * The tokens of each block that stand on the text they name. A blank token
 * is dropped, and so is one whose surface is not what the text holds at its
 * place; what remains is words of the text itself.
 */
export function readableTokens(doc: TextDocument, tokens: BlockTokens): Map<number, Token[]> {
  return new Map(
    [...tokens].map(([index, list]) => [
      index,
      list.filter((token) => !BLANK.test(token.surface) && doc.text.slice(token.start, token.end) === token.surface),
    ]),
  )
}

/**
 * The readable tokens of each of the sentences, by where a token starts. A
 * sentence of a block the engine did not read, or without a readable token,
 * is left out.
 */
export function sentenceTokens(
  doc: TextDocument,
  tokens: BlockTokens,
  sentences: readonly Sentence[],
): SentenceTokens[] {
  const readable = readableTokens(doc, tokens)
  const indexes = [...readable.keys()]
  return sentences.flatMap((sentence) => {
    const index = indexes.find((at) => {
      const { start, end } = doc.blocks[at]
      return sentence.start >= start && sentence.start < end
    })
    const inside = (index === undefined ? [] : readable.get(index)!).filter(
      ({ start }) => start >= sentence.start && start < sentence.end,
    )
    return inside.length === 0 ? [] : [{ sentence, tokens: inside }]
  })
}
