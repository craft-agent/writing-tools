import type { Token } from "../../engine/tokens"
import type { TextDocument } from "../model"
import type { RawFinding } from "../rules"
import { readableChars } from "./density"
import { readableLines } from "./lines"
import { mtld } from "./mtld"
import { LEXICAL_MIN_CHARS, LEXICAL_MIN_WORDS, LEXICAL_TOP_WORDS, MTLD_BELOW } from "./thresholds"
import { readableTokens, type BlockTokens } from "./tokenized"

/** The parts of speech whose tokens are content words: the words that carry what the text is about. */
const CONTENT_POS: ReadonlySet<string> = new Set(["名詞", "動詞", "形容詞", "副詞"])

/** The finer kinds that are no content word: numerals, verbs and nouns that only support another word, and pronouns. */
const FUNCTION_KINDS: ReadonlySet<string> = new Set(["数詞", "非自立可能", "代名詞"])

/** A word of the text and how often it comes: its first token and the number of its tokens. */
type Repeated = { first: Token; count: number }

const NOUN = "名詞"

/** How the report writes a word: a noun as it stands in the text, any other by its dictionary form, so an inflected verb is named by its plain form. */
function labelOf({ pos, surface, dictionary }: Token): string {
  return pos[0] === NOUN ? surface : dictionary || surface
}

/** The words of the text in order that carry content: by the dictionary form, so an inflected word counts as one. */
function contentWords(doc: TextDocument, tokens: BlockTokens): Token[] {
  return [...readableTokens(doc, tokens)]
    .sort(([a], [b]) => a - b)
    .flatMap(([, list]) => list)
    .filter(({ pos }) => CONTENT_POS.has(pos[0]) && !FUNCTION_KINDS.has(pos[1]))
}

/** How often each word comes, the most often first and, among the same, the one that comes first. */
function mostRepeated(words: readonly Token[], keys: readonly string[]): Repeated[] {
  const counts = new Map<string, Repeated>()
  for (const [at, token] of words.entries()) {
    const seen = counts.get(keys[at])
    if (seen === undefined) counts.set(keys[at], { first: token, count: 1 })
    else seen.count++
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

/**
 * The `lexical_repetition` finding: the content words of the text, by their
 * dictionary form, are drawn from a small stock for their number, by MTLD,
 * once the text is long enough to judge. It spans the first token of the word
 * that comes most often, and names that word and the next most repeated.
 */
export function findLexicalRepetition(doc: TextDocument, tokens: BlockTokens): RawFinding[] {
  if (readableChars(readableLines(doc)) < LEXICAL_MIN_CHARS) return []
  const words = contentWords(doc, tokens)
  if (words.length < LEXICAL_MIN_WORDS) return []
  const keys = words.map(({ dictionary, surface }) => dictionary || surface)
  const diversity = mtld(keys)
  if (diversity >= MTLD_BELOW) return []
  const repeated = mostRepeated(words, keys)
  const named = repeated
    .slice(0, LEXICAL_TOP_WORDS)
    .map(({ first, count }) => `${labelOf(first)} (${count})`)
    .join(", ")
  const { start, end } = repeated[0].first
  return [
    {
      rule: "lexical_repetition",
      start,
      end,
      reason: `MTLD ${diversity.toFixed(1)} over ${words.length} content words, below ${MTLD_BELOW}: a small stock of words is reused; the most repeated are ${named}`,
    },
  ]
}
