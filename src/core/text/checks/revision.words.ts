import type { Token } from "../../engine/tokens"
import { SEGMENT_KINDS, type TextDocument } from "../model"
import { contentWords } from "./lexical"
import { numbersOf } from "./numbers"
import { termUsesOf } from "./terms"
import type { BlockTokens } from "./tokenized"
import type { Use } from "./uses"

/**
 * The content words a revision keeps or loses, as the package's own data.
 * They are the tokens `lexical_repetition` counts, by the engine's normalized
 * form, so a spelling-only change (行なう and 行う) is no change of word, less
 * what the other rules of the check already report and the words so common
 * that their coming and going says nothing about the text.
 */

/** The rule for a content word the original has more of than the revision. */
export const CONTENT_LOST_RULE = "content_word_lost"

/** The rule for a content word the revision has more of than the original. */
export const CONTENT_ADDED_RULE = "content_word_added"

/**
 * Words that carry no content of their own: the light verbs, the formal nouns
 * and the like, by normalized form, which merges their kana and kanji
 * spellings (する and 為る are 為る, ため and 為 are 為). こと is not merged
 * with 事 and stays both. 前 and 後 are not among them: swapping them
 * reverses a meaning.
 */
const LIGHT_WORDS: ReadonlySet<string> = new Set([
  "為る",
  "有る",
  "居る",
  "成る",
  "出来る",
  "こと",
  "事",
  "物",
  "様",
  "為",
  "時",
  "所",
  "訳",
  "筈",
  "方",
])

/** A digit: a token that holds one is a number, or part of an identifier, and is no word. */
const DIGIT = /\d/

/** The key of a content word: its normalized form, else its dictionary form, else its surface, in compatibility form. */
function keyOf({ normalized, dictionary, surface }: Pick<Token, "normalized" | "dictionary" | "surface">): string {
  return (normalized || dictionary || surface).normalize("NFKC")
}

/** Which characters of the text the numbers and the names of the check cover, by offset. */
function coveredByOtherRules(doc: TextDocument): Uint8Array {
  const covered = new Uint8Array(doc.text.length)
  for (const { start, end } of [...numbersOf(doc), ...termUsesOf(doc)]) covered.fill(1, start, end)
  return covered
}

/**
 * Every content word of the prose and list items, in order of position, keyed
 * by its normalized form (see {@link keyOf}), so an inflected or respelt word is one. A
 * number, a word of the light list and a token that stands wholly inside a
 * number or a name are left out: `number_*` and `name_*` report those. A block
 * the engine did not read has no word.
 */
export function contentUsesOf(doc: TextDocument, tokens: BlockTokens): Use[] {
  const covered = coveredByOtherRules(doc)
  return contentWords(doc, tokens).flatMap((token) => {
    const key = keyOf(token)
    if (DIGIT.test(key) || LIGHT_WORDS.has(key)) return []
    if (covered.subarray(token.start, token.end).every(Boolean)) return []
    return [{ key, form: token.surface, start: token.start, end: token.end }]
  })
}

/** Whether the engine read every block of prose and list items of the text: a count of words is sound only then. */
export function isWhollyRead(doc: TextDocument, tokens: BlockTokens): boolean {
  return doc.blocks.every((block, index) => !SEGMENT_KINDS.includes(block.kind) || tokens.has(index))
}
